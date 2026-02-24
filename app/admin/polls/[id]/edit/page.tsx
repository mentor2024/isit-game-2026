import Link from "next/link";
import { ArrowLeft, ArrowRight, Edit } from "lucide-react";
import EditPollForm from "@/components/EditPollForm";
import { getServiceRoleClient } from "@/lib/supabaseServer";
import BackToPollsLink from "@/components/BackToPollsLink";

async function getPoll(id: string) {
    const adminClient = getServiceRoleClient();
    const { data: poll } = await adminClient.from('polls').select('*, poll_objects(*)').eq('id', id).single();
    return poll;
}

async function getAdjacentPolls(stage: number, level: number, currentOrder: number) {
    const adminClient = getServiceRoleClient();

    const { data: polls } = await adminClient
        .from('polls')
        .select('id, poll_order, title')
        .eq('stage', stage)
        .eq('level', level)
        .order('poll_order', { ascending: true });

    if (!polls || polls.length === 0) return { prev: null, next: null };

    const currentIndex = polls.findIndex((p: any) => p.poll_order === currentOrder);
    const prev = currentIndex > 0 ? polls[currentIndex - 1] : null;
    const next = currentIndex < polls.length - 1 ? polls[currentIndex + 1] : null;

    return { prev, next };
}

export default async function EditPollPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const poll = await getPoll(id);
    console.log(`[EditPollPage] Loaded Poll ${id}: Stage =`, poll?.stage, typeof poll?.stage);

    if (!poll) return <div className="p-8">Poll not found</div>;

    const adminClient = getServiceRoleClient();
    const { count: voteCount } = await adminClient
        .from('poll_votes')
        .select('*', { count: 'exact', head: true })
        .eq('poll_id', id);

    const { prev, next } = await getAdjacentPolls(poll.stage, poll.level, poll.poll_order);

    return (
        <div className="max-w-2xl mx-auto p-8">
            <BackToPollsLink />

            <div className="flex justify-between items-center mb-8">
                <h1 className="text-4xl font-black">Edit Poll</h1>

                {/* Prev / Next */}
                <div className="flex items-center gap-3">
                    {prev ? (
                        <Link
                            href={`/admin/polls/${prev.id}/edit`}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-full border-2 border-gray-300 text-gray-600 font-bold text-sm hover:border-black hover:text-black transition-colors"
                            title={prev.title}
                        >
                            <ArrowLeft size={15} />
                            Prev
                        </Link>
                    ) : (
                        <span className="flex items-center gap-1.5 px-4 py-2 rounded-full border-2 border-gray-100 text-gray-300 font-bold text-sm cursor-not-allowed">
                            <ArrowLeft size={15} />
                            Prev
                        </span>
                    )}

                    {next ? (
                        <Link
                            href={`/admin/polls/${next.id}/edit`}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-full border-2 border-gray-300 text-gray-600 font-bold text-sm hover:border-black hover:text-black transition-colors"
                            title={next.title}
                        >
                            Next
                            <ArrowRight size={15} />
                        </Link>
                    ) : (
                        <span className="flex items-center gap-1.5 px-4 py-2 rounded-full border-2 border-gray-100 text-gray-300 font-bold text-sm cursor-not-allowed">
                            Next
                            <ArrowRight size={15} />
                        </span>
                    )}
                </div>
            </div>

            <EditPollForm poll={poll} voteCount={voteCount || 0} />
        </div>
    );
}
