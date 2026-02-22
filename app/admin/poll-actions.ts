"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSupabase, getServiceRoleClient } from "@/lib/supabaseServer";
import { GoogleGenerativeAI } from "@google/generative-ai";

async function checkRole() {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const serviceClient = getServiceRoleClient();
    const { data: profile } = await serviceClient
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    return profile?.role;
}

export async function createPoll(formData: FormData) {
    const currentRole = await checkRole();
    if (currentRole !== 'admin' && currentRole !== 'superadmin') {
        throw new Error("Unauthorized");
    }

    const type = (formData.get("type") as string) || "isit_text";
    const title = formData.get("title") as string;
    const instructions = formData.get("instructions") as string;
    const feedback_correct = formData.get("feedback_correct") as string;
    const feedback_incorrect = formData.get("feedback_incorrect") as string;

    // Four new consensus fields
    const consensus_1_majority = formData.get("consensus_1_majority") as string;
    const consensus_1_minority = formData.get("consensus_1_minority") as string;
    const consensus_2_majority = formData.get("consensus_2_majority") as string;
    const consensus_2_minority = formData.get("consensus_2_minority") as string;

    const izzy_image = formData.get("izzy_image") as string;
    const izzy_quote = formData.get("izzy_quote") as string;

    const stage = parseInt(formData.get("stage") as string);
    // If NaN, default to 1. If 0, keep 0.
    const safeStage = isNaN(stage) ? 1 : stage;
    const level = parseInt(formData.get("level") as string) || 1;
    const poll_order = parseInt(formData.get("poll_order") as string) || 1;

    // Helper to clean HTML (Remove &nbsp; to prevent layout breaking)
    const cleanHtml = (s: string) => s ? s.replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ') : s;

    // Common validations
    if (!title || !type) {
        throw new Error("Missing required fields");
    }

    const supabase = getServiceRoleClient();

    // Clean Instructions
    const clean_instructions = cleanHtml(instructions);
    const clean_feedback_correct = cleanHtml(feedback_correct);
    const clean_feedback_incorrect = cleanHtml(feedback_incorrect);

    // Extract Quad Scores if applicable
    let quad_scores = {};
    let quad_feedback = {};
    if (type === 'quad_sorting') {
        quad_scores = {
            '1-2': parseInt(formData.get("score_12") as string) || 0,
            '1-3': parseInt(formData.get("score_13") as string) || 0,
            '1-4': parseInt(formData.get("score_14") as string) || 0
        };
        quad_feedback = {
            '1-2': cleanHtml(formData.get("feedback_12") as string || ""),
            '1-3': cleanHtml(formData.get("feedback_13") as string || ""),
            '1-4': cleanHtml(formData.get("feedback_14") as string || "")
        };
    }

    // 1. Create Poll
    const { data: poll, error: pollError } = await supabase
        .from('polls')
        .insert({
            title,
            instructions: clean_instructions,
            feedback_correct: clean_feedback_correct,
            feedback_incorrect: clean_feedback_incorrect,
            consensus_1_majority: cleanHtml(consensus_1_majority),
            consensus_1_minority: cleanHtml(consensus_1_minority),
            consensus_2_majority: cleanHtml(consensus_2_majority),
            consensus_2_minority: cleanHtml(consensus_2_minority),
            stage: safeStage,
            level,
            poll_order,
            type,
            quad_scores,
            quad_feedback,
            izzy_image,
            izzy_quote: cleanHtml(izzy_quote)
        })
        .select()
        .single();

    if (pollError) throw new Error(pollError.message);

    try {
        // 2. Process Objects (Upload if needed)
        const objects = [];

        // Determine object count based on type
        let objectCount = 2;
        if (type === 'quad_sorting') {
            objectCount = 4;
        } else if (type === 'multiple_choice') {
            const explicitCount = parseInt(formData.get("object_count") as string);
            objectCount = !isNaN(explicitCount) ? explicitCount : 5;
        }

        for (let i = 1; i <= objectCount; i++) {
            const side = formData.get(`obj${i}_side`) as string;
            const textInput = formData.get(`obj${i}_text`) as string;
            const fileInput = formData.get(`obj${i}_image`) as File;

            let imageUrl = null;
            let text = cleanHtml(textInput);

            // For Quad Sorting OR Image ISIT, we expect images
            const needsImage = type === "isit_image" || type === "quad_sorting";

            if (needsImage) {
                if (!fileInput || fileInput.size === 0) throw new Error(`Image for Object ${i} is missing`);

                // Upload Image
                const fileExt = fileInput.name.split('.').pop();
                const filePath = `${poll.id}/${i}_${Date.now()}.${fileExt}`;

                const { error: uploadError } = await supabase
                    .storage
                    .from('poll_images')
                    .upload(filePath, fileInput, {
                        contentType: fileInput.type,
                        upsert: true
                    });

                if (uploadError) throw new Error(`Upload failed for Object ${i}: ${uploadError.message}`);

                // Get Public URL
                const { data: { publicUrl } } = supabase.storage.from('poll_images').getPublicUrl(filePath);
                imageUrl = publicUrl;
            } else {
                if (!textInput) throw new Error(`Text for Object ${i} is missing`);
            }

            const newObj: any = {
                id: `poll:${poll.id}:${i}`,
                poll_id: poll.id,
                text: text,
                image_url: imageUrl
            };

            if (type === 'quad_sorting') {
                newObj.attributes = { sort_id: i };
            } else if (type === 'isit_text_plus') {
                // Consensus polls have no pre-defined correct side — majority vote determines the answer
                // correct_side is intentionally left unset
            } else {
                // Standard ISIT types use a pre-defined correct side
                if (side) newObj.correct_side = side;
            }

            // Handle Points (Multiple Choice)
            const pointsInput = formData.get(`obj${i}_points`);
            if (pointsInput !== null) {
                newObj.points = parseInt(pointsInput as string) || 0;
            }

            objects.push(newObj);
        }

        // 3. Insert Objects
        const { error: objsError } = await supabase
            .from('poll_objects')
            .insert(objects);

        if (objsError) throw new Error(objsError.message);

    } catch (e: any) {
        // Cleanup poll if objects/upload fail
        await supabase.from('polls').delete().eq('id', poll.id);
        throw new Error(e.message);
    }

    revalidatePath('/admin');
    revalidatePath('/poll');
}

export async function deletePoll(formData: FormData) {
    const currentRole = await checkRole();
    if (currentRole !== 'admin' && currentRole !== 'superadmin') {
        throw new Error("Unauthorized");
    }

    const pollId = formData.get("pollId") as string;
    const supabase = getServiceRoleClient();

    // Cascade delete handles objects/votes usually, provided FK is set up with ON DELETE CASCADE
    const { error } = await supabase.from('polls').delete().eq('id', pollId);

    if (error) throw new Error(error.message);

    revalidatePath('/admin');
    revalidatePath('/poll');
}

export async function bulkDeletePolls(pollIds: string[]) {
    const currentRole = await checkRole();
    if (currentRole !== 'superadmin') {
        throw new Error("Unauthorized: Only superadmins can bulk delete polls.");
    }

    if (!pollIds || pollIds.length === 0) return { success: true };

    const supabase = getServiceRoleClient();

    // Supabase will cascade delete 'poll_objects' and 'votes' via Foreign Keys
    const { error } = await supabase.from('polls').delete().in('id', pollIds);

    if (error) throw new Error(error.message);

    revalidatePath('/admin');
    revalidatePath('/poll');
    return { success: true };
}

export async function updatePoll(formData: FormData) {
    console.log("------- UPDATE POLL ACTION CALLED -------");
    const currentRole = await checkRole();
    if (currentRole !== 'admin' && currentRole !== 'superadmin') {
        throw new Error("Unauthorized");
    }

    const pollId = formData.get("pollId") as string;
    const title = formData.get("title") as string;
    const instructions = formData.get("instructions") as string;
    const feedback_correct = formData.get("feedback_correct") as string;
    const feedback_incorrect = formData.get("feedback_incorrect") as string;

    const consensus_1_majority = formData.get("consensus_1_majority") as string;
    const consensus_1_minority = formData.get("consensus_1_minority") as string;
    const consensus_2_majority = formData.get("consensus_2_majority") as string;
    const consensus_2_minority = formData.get("consensus_2_minority") as string;

    const izzy_image = formData.get("izzy_image") as string;
    const izzy_quote = formData.get("izzy_quote") as string;

    if (!pollId || !title) {
        throw new Error("Missing required fields");
    }

    const supabase = getServiceRoleClient();

    const stageRaw = parseInt(formData.get("stage") as string);
    const stage = isNaN(stageRaw) ? 1 : stageRaw;
    console.log(`[updatePoll] Stage Update: Raw=${formData.get("stage")} Parsed=${stageRaw} Final=${stage}`);

    const level = parseInt(formData.get("level") as string) || 1;
    const poll_order = parseInt(formData.get("poll_order") as string) || 1;

    // Helper to clean HTML
    const cleanHtml = (s: string) => s ? s.replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ') : s;

    // Clean Instructions
    const clean_instructions = cleanHtml(instructions);
    const clean_feedback_correct = cleanHtml(feedback_correct);
    const clean_feedback_incorrect = cleanHtml(feedback_incorrect);

    const updates: any = {
        title,
        instructions: clean_instructions,
        feedback_correct: clean_feedback_correct,
        feedback_incorrect: clean_feedback_incorrect,
        consensus_1_majority: cleanHtml(consensus_1_majority),
        consensus_1_minority: cleanHtml(consensus_1_minority),
        consensus_2_majority: cleanHtml(consensus_2_majority),
        consensus_2_minority: cleanHtml(consensus_2_minority),
        stage,
        level,
        poll_order,
        izzy_image,
        izzy_quote: cleanHtml(izzy_quote)
    };

    if (formData.has("score_12")) {
        updates.quad_scores = {
            '1-2': parseInt(formData.get("score_12") as string) || 0,
            '1-3': parseInt(formData.get("score_13") as string) || 0,
            '1-4': parseInt(formData.get("score_14") as string) || 0
        };
        updates.quad_feedback = {
            '1-2': cleanHtml(formData.get("feedback_12") as string || ""),
            '1-3': cleanHtml(formData.get("feedback_13") as string || ""),
            '1-4': cleanHtml(formData.get("feedback_14") as string || "")
        };
    }

    // 1. Update Poll Details
    const { error: pollError } = await supabase
        .from('polls')
        .update(updates)
        .eq('id', pollId);

    if (pollError) throw new Error(pollError.message);

    // 2. Update Objects if provided.
    if (formData.has("obj1_text")) {
        try {
            const processObjectUpdate = async (index: number) => {
                const textInput = formData.get(`obj${index}_text`) as string;
                if (textInput === null) return; // Field not present in form

                const explicitId = formData.get(`obj${index}_id`) as string;
                const objectId = explicitId || `poll:${pollId}:${index}`;

                console.log(`[updatePoll] Object ${index}: ID=${objectId}`);

                const side = formData.get(`obj${index}_side`) as string;
                const fileInput = formData.get(`obj${index}_image`) as File;
                const feedback = formData.get(`obj${index}_feedback`) as string;

                const updates: any = {
                    text: cleanHtml(textInput),
                    feedback: cleanHtml(feedback || "")
                };

                if (side) {
                    updates.correct_side = side;
                }

                const pointsInput = formData.get(`obj${index}_points`);
                console.log(`[updatePoll] Object ${index}: Points Input = ${pointsInput} (Type: ${typeof pointsInput})`);

                if (pointsInput !== null) {
                    updates.points = parseInt(pointsInput as string) || 0;
                    console.log(`[updatePoll] Object ${index}: Setting updates.points = ${updates.points}`);
                }

                if (fileInput && fileInput.size > 0) {
                    const fileExt = fileInput.name.split('.').pop();
                    const filePath = `${pollId}/${index}_${Date.now()}.${fileExt}`;

                    const { error: uploadError } = await supabase
                        .storage
                        .from('poll_images')
                        .upload(filePath, fileInput, {
                            contentType: fileInput.type,
                            upsert: true
                        });

                    if (uploadError) throw new Error(`Upload failed for Object ${index}: ${uploadError.message}`);

                    const { data: { publicUrl } } = supabase.storage.from('poll_images').getPublicUrl(filePath);
                    updates.image_url = publicUrl;
                }

                const { error: updateError } = await supabase
                    .from('poll_objects')
                    .update(updates)
                    .eq('id', objectId);

                if (updateError) throw new Error(`Failed to update Object ${index}: ${updateError.message}`);
            };

            for (let i = 1; i <= 5; i++) {
                await processObjectUpdate(i);
            }

        } catch (e: any) {
            throw new Error(e.message);
        }
    }

    revalidatePath('/admin');
    revalidatePath('/poll');
    redirect(`/admin/polls/${pollId}`);
}

export async function updatePollHierarchyField(pollId: string, field: 'stage' | 'level' | 'poll_order', value: number) {
    const currentRole = await checkRole();
    if (currentRole !== 'admin' && currentRole !== 'superadmin') {
        throw new Error("Unauthorized");
    }

    const supabase = getServiceRoleClient();

    // Validate value within limits. Stage can be 0.
    const minVal = field === 'stage' ? 0 : 1;
    const safeValue = Math.max(minVal, Math.min(20, value));

    const { error } = await supabase
        .from('polls')
        .update({ [field]: safeValue })
        .eq('id', pollId);

    if (error) throw new Error(error.message);

    revalidatePath('/admin');
    revalidatePath('/poll');
}

export async function clonePoll(pollId: string) {
    const currentRole = await checkRole();
    if (currentRole !== 'admin' && currentRole !== 'superadmin') {
        throw new Error("Unauthorized");
    }

    const supabase = getServiceRoleClient();

    // 1. Fetch Original
    const { data: original, error: fetchError } = await supabase
        .from('polls')
        .select('*, poll_objects(*)')
        .eq('id', pollId)
        .single();

    if (fetchError || !original) throw new Error("Poll not found");

    // 2. Create Clone — carries all feedback fields regardless of poll type
    const { data: newPoll, error: createError } = await supabase
        .from('polls')
        .insert({
            title: `Copy of ${original.title}`,
            instructions: original.instructions,
            feedback_correct: original.feedback_correct,
            feedback_incorrect: original.feedback_incorrect,
            feedback_majority: original.feedback_majority,
            feedback_minority: original.feedback_minority,
            type: original.type,
            stage: original.stage,
            level: original.level,
            poll_order: original.poll_order
        })
        .select()
        .single();

    if (createError) throw new Error(createError.message);

    // 3. Clone Objects
    if (original.poll_objects && original.poll_objects.length > 0) {
        const newObjects = original.poll_objects.map((obj: any, index: number) => ({
            id: `poll:${newPoll.id}:${index + 1}`,
            poll_id: newPoll.id,
            text: obj.text,
            correct_side: obj.correct_side,
            image_url: obj.image_url,
            points: obj.points,
            feedback: obj.feedback,
            attributes: obj.attributes
        }));

        const { error: objError } = await supabase
            .from('poll_objects')
            .insert(newObjects);

        if (objError) {
            console.error("Failed to clone objects:", objError);
        }
    }

    revalidatePath('/admin');
    return { success: true, newId: newPoll.id };
}

export async function bulkCreatePolls(formData: FormData) {
    const currentRole = await checkRole();
    if (currentRole !== 'admin' && currentRole !== 'superadmin') {
        throw new Error("Unauthorized");
    }

    const type = (formData.get("type") as string) || "isit_text";
    const bulkData = formData.get("bulk_data") as string;
    const instructions = formData.get("instructions") as string;
    const stage = parseInt(formData.get("stage") as string);
    const safeStage = isNaN(stage) ? 1 : stage;
    const level = parseInt(formData.get("level") as string) || 1;

    // Helper to clean HTML
    const cleanHtml = (s: string) => s ? s.replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ') : s;
    const clean_instructions = cleanHtml(instructions);

    if (!bulkData || !type) {
        throw new Error("Missing required fields");
    }

    const supabase = getServiceRoleClient();

    const lines = bulkData.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length === 0) {
        throw new Error("No valid data rows found");
    }

    let createdCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const poll_order = i + 1;
        const title = line;

        // Try to split objects if ' | ' is present
        let obj1Text = line;
        let obj2Text = line;

        if (line.includes('|')) {
            const parts = line.split('|').map(p => p.trim());
            obj1Text = parts[0] || "Left";
            obj2Text = parts[1] || "Right";
        }

        // 0. AI Generation for ISIT Text Plus
        let c1_maj = "";
        let c1_min = "";
        let c2_maj = "";
        let c2_min = "";

        if (type === 'isit_text_plus' && process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
            try {
                const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
                const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

                const prompt = `You are a helpful assistant for a social awareness sorting game. The user is presented with two concepts: "${obj1Text}" and "${obj2Text}". This is a consensus poll where there is no objectively right answer; players must guess which concept the majority of other players will choose.
                
Write 4 short, distinct feedback messages (1-2 sentences each) explaining the potential psychology or reasoning behind the player's choice.
Do NOT use markdown outside of the JSON block. Return EXACTLY a valid JSON object with these exact keys:
"consensus_1_majority": (Feedback if the majority chose ${obj1Text}, and the player also chose ${obj1Text})
"consensus_1_minority": (Feedback if the majority chose ${obj2Text}, but the player chose ${obj1Text})
"consensus_2_majority": (Feedback if the majority chose ${obj2Text}, and the player also chose ${obj2Text})
"consensus_2_minority": (Feedback if the majority chose ${obj1Text}, but the player chose ${obj2Text})
`;

                const result = await model.generateContent(prompt);
                const responseText = result.response.text().replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim();
                const feedbackData = JSON.parse(responseText);

                c1_maj = cleanHtml(feedbackData.consensus_1_majority || "");
                c1_min = cleanHtml(feedbackData.consensus_1_minority || "");
                c2_maj = cleanHtml(feedbackData.consensus_2_majority || "");
                c2_min = cleanHtml(feedbackData.consensus_2_minority || "");
            } catch (err) {
                console.error("Gemini Generation Error on line", i + 1, err);
            }
        }

        // 1. Create Poll
        const { data: poll, error: pollError } = await supabase
            .from('polls')
            .insert({
                title,
                instructions: clean_instructions,
                consensus_1_majority: c1_maj,
                consensus_1_minority: c1_min,
                consensus_2_majority: c2_maj,
                consensus_2_minority: c2_min,
                stage: safeStage,
                level,
                poll_order,
                type
            })
            .select()
            .single();

        if (pollError) throw new Error(`Failed on line ${i + 1}: ${pollError.message}`);

        // 2. Process Objects
        const objects = [];

        // Obj 1
        const newObj1: any = {
            id: `poll:${poll.id}:1`,
            poll_id: poll.id,
            text: cleanHtml(obj1Text),
        };

        // Obj 2
        const newObj2: any = {
            id: `poll:${poll.id}:2`,
            poll_id: poll.id,
            text: cleanHtml(obj2Text),
        };

        if (type !== 'isit_text_plus') {
            // Standard ISIT types use a pre-defined correct side
            // For bulk add, we auto-assign Left = IS, Right = IT arbitrarily to save time
            newObj1.correct_side = "IS";
            newObj2.correct_side = "IT";
        }

        objects.push(newObj1, newObj2);

        // 3. Insert Objects
        const { error: objsError } = await supabase
            .from('poll_objects')
            .insert(objects);

        if (objsError) {
            // Cleanup poll if objects fail
            await supabase.from('polls').delete().eq('id', poll.id);
            throw new Error(`Failed to insert objects on line ${i + 1}: ${objsError.message}`);
        }

        createdCount++;
    }

    revalidatePath('/admin');
    revalidatePath('/poll');

    return { success: true, count: createdCount };
}
