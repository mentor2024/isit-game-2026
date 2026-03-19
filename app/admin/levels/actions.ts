"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function saveLevelConfig(stage: number, level: number, formData: FormData) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { cookies: { getAll() { return [] }, setAll() { } } }
    );

    const is_linked = formData.get("is_linked") === "on";
    const show_interstitial = formData.get("show_interstitial") === "on";

    const cleanHtml = (s: string) => {
        if (!s) return s;
        return s
            .replace(/&nbsp;/g, ' ')
            .replace(/\u00A0/g, ' ')
            .replace(/&amp;nbsp;/g, ' ')
            .replace(/&#160;/g, ' ');
    };

    const instructions = cleanHtml(formData.get("instructions") as string);
    const intro_content = cleanHtml(formData.get("intro_content") as string);

    const pathSelectorConfigRaw = formData.get("path_selector_config") as string;
    const pathSelectorConfig = pathSelectorConfigRaw ? JSON.parse(pathSelectorConfigRaw) : {};

    // layout_config is the source of truth for modules now
    const layoutConfigRaw = formData.get("layout_config") as string;
    const layoutConfig = layoutConfigRaw ? JSON.parse(layoutConfigRaw) : null;

    // Derive enabled_modules from layout_config so legacy code keeps working
    const modules: string[] = layoutConfig
        ? layoutConfig.rows
            .flatMap((row: any) => row.columns.map((col: any) => col.moduleId))
            .filter(Boolean)
        : (formData.getAll("modules") as string[]);

    try {
        const { error } = await supabase
            .from('level_configurations')
            .upsert({
                stage,
                level,
                instructions,
                intro_content,
                is_linked,
                show_interstitial,
                enabled_modules: modules,
                layout_config: layoutConfig,
                path_selector_config: pathSelectorConfig,
                updated_at: new Date().toISOString()
            }, { onConflict: 'stage, level' });

        if (error) {
            console.error("Error saving level config:", error);
            return { success: false, error: error.message };
        }

        revalidatePath(`/admin/levels/${stage}/${level}`);
        revalidatePath(`/levelup`);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function bulkUpdateLevelModules(updates: { stage: number, level: number, enabled_modules: string[] }[]) {
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { cookies: { getAll() { return [] }, setAll() { } } }
    );

    try {
        for (const update of updates) {
            const { data: existing } = await supabase
                .from('level_configurations')
                .select('stage, level')
                .eq('stage', update.stage)
                .eq('level', update.level)
                .maybeSingle();

            if (existing) {
                const { error } = await supabase
                    .from('level_configurations')
                    .update({ enabled_modules: update.enabled_modules, updated_at: new Date().toISOString() })
                    .eq('stage', existing.stage)
                    .eq('level', existing.level);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('level_configurations')
                    .insert({
                        stage: update.stage,
                        level: update.level,
                        enabled_modules: update.enabled_modules,
                        instructions: "Complete this level.",
                        path_selector_config: {}
                    });
                if (error) throw error;
            }
        }

        revalidatePath('/admin/levels');
        revalidatePath('/levelup');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
