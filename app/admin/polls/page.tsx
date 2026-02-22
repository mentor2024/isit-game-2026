import Link from "next/link";
import { Plus } from "lucide-react";
import PollFilters from "@/components/PollFilters";
import PollListWithSelection from "@/components/PollListWithSelection";
import { getServiceRoleClient, getServerSupabase } from "@/lib/supabaseServer";

export const dynamic = 'force-dynamic';

export default async function AdminPollsPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams;
    const stage = params.stage as string;
    const level = params.level as string;
    const poll_order = params.poll_order as string;
    const type = params.type as string;
    const search = params.search as string;

    // Sort params
    const sort_by = (params.sort_by as string) || 'created_at';
    const sort_order = (params.sort_order as string) === 'asc' ? 'asc' : 'desc';

    const supAuth = await getServerSupabase();
    const { data: { user } } = await supAuth.auth.getUser();

    const adminClient = getServiceRoleClient();

    let userRole = null;
    if (user) {
        const { data: profile } = await adminClient
            .from('user_profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        userRole = profile?.role;
    }

    let query = adminClient.from('polls').select('*');

    // Search
    if (search) {
        const { data: objectMatches } = await adminClient
            .from('poll_objects')
            .select('poll_id')
            .ilike('text', `%${search}%`);

        const objectPollIds = objectMatches?.map(o => o.poll_id) || [];
        const uniqueObjectPollIds = Array.from(new Set(objectPollIds));

        if (uniqueObjectPollIds.length > 0) {
            query = query.or(`title.ilike.%${search}%,id.in.(${uniqueObjectPollIds.join(',')})`);
        } else {
            query = query.ilike('title', `%${search}%`);
        }
    }

    // Filters
    if (stage) query = query.eq('stage', stage);
    if (level) query = query.eq('level', level);
    if (poll_order) query = query.eq('poll_order', poll_order);
    if (type) query = query.eq('type', type);

    // Dynamic Sort
    query = query.order(sort_by, { ascending: sort_order === 'asc' });

    // Secondary sorts for stability
    if (sort_by !== 'stage') query = query.order('stage', { ascending: true });
    if (sort_by !== 'level') query = query.order('level', { ascending: true });
    if (sort_by !== 'poll_order') query = query.order('poll_order', { ascending: true });
    if (sort_by !== 'created_at') query = query.order('created_at', { ascending: false });

    const { data: polls } = await query;

    // Pass necessary searchParams down for sort URL generation
    const currentParams = { stage, level, poll_order, type, search };

    return (
        <div className="max-w-6xl mx-auto p-8">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-4xl font-black">Polls</h1>
                <div className="flex gap-3">
                    <Link href="/admin/polls/bulk" className="bg-gray-100 text-black border-2 border-black px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-gray-200 transition-colors">
                        <Plus size={20} />
                        Bulk Add
                    </Link>
                    <Link href="/admin/polls/new" className="bg-black text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:scale-105 transition-transform">
                        <Plus size={20} />
                        New Poll
                    </Link>
                </div>
            </div>

            <PollFilters />

            <PollListWithSelection
                polls={polls || []}
                userRole={userRole}
                searchParams={currentParams}
                sortBy={sort_by}
                sortOrder={sort_order}
            />
        </div>
    );
}
