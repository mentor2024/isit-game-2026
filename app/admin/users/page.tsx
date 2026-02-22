import Link from "next/link";
import { getServerSupabase, getServiceRoleClient } from "@/lib/supabaseServer";
import { Plus } from "lucide-react";
import UserListWithSelection from "@/components/UserListWithSelection";
import UserFilters from "@/components/UserFilters";

async function getUsers(user: any) {
    const serviceClient = getServiceRoleClient();

    const [usersRes, profilesRes] = await Promise.all([
        serviceClient.auth.admin.listUsers(),
        serviceClient.from('user_profiles').select('*')
    ]);

    const users = usersRes.data.users || [];
    const profiles = profilesRes.data || [];
    const roleMap = new Map(profiles.map(p => [p.id, p.role]));

    const currentUserProfile = profiles.find(p => p.id === user.id);
    const currentUserRole = currentUserProfile?.role || 'user';

    return { users, profiles, roleMap, currentUserRole, error: usersRes.error };
}

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams;
    const search = params.search as string;
    const startDate = params.start_date as string;
    const endDate = params.end_date as string;
    const stage = params.stage as string;
    const level = params.level as string;

    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return <div>Unauthorized</div>;

    const { users: allUsers, profiles, roleMap, currentUserRole, error } = await getUsers(user);

    // Fetch Last & First Poll Data for all users
    const userPollData = await Promise.all(allUsers.map(async (u) => {
        const serviceClient = getServiceRoleClient();

        const [lastVoteRes, firstVoteRes] = await Promise.all([
            // Get last vote
            serviceClient
                .from('poll_votes')
                .select('created_at, polls(title, stage, level)')
                .eq('user_id', u.id)
                .order('created_at', { ascending: false })
                .limit(1),
            // Get first vote date
            serviceClient
                .from('poll_votes')
                .select('created_at')
                .eq('user_id', u.id)
                .order('created_at', { ascending: true })
                .limit(1)
        ]);

        const lastVote = lastVoteRes.data && lastVoteRes.data.length > 0 ? lastVoteRes.data[0] : null;
        const firstVoteDate = firstVoteRes.data && firstVoteRes.data.length > 0 ? firstVoteRes.data[0].created_at : null;

        return { userId: u.id, lastVote, firstVoteDate };
    }));

    // Create a map for quick lookup
    const pollDataMap = new Map(userPollData.map(i => [i.userId, { lastVote: i.lastVote, firstVoteDate: i.firstVoteDate }]));

    // Apply Client-Side Filters
    let filteredUsers = [...allUsers];

    // Filter by Search (Username or Email)
    if (search) {
        const lowerSearch = search.toLowerCase();
        filteredUsers = filteredUsers.filter(u => {
            const p = profiles.find(p => p.id === u.id);
            const usernameMatch = p?.avatar_name?.toLowerCase().includes(lowerSearch);
            const emailMatch = u.email?.toLowerCase().includes(lowerSearch);
            return usernameMatch || emailMatch;
        });
    }

    // Filter by Stage
    if (stage) {
        filteredUsers = filteredUsers.filter(u => {
            const p = profiles.find(p => p.id === u.id);
            return p?.current_stage === parseInt(stage);
        });
    }

    // Filter by Level
    if (level) {
        filteredUsers = filteredUsers.filter(u => {
            const p = profiles.find(p => p.id === u.id);
            return p?.current_level === parseInt(level);
        });
    }

    // Filter by Start Date (First Poll Date)
    if (startDate) {
        const start = new Date(startDate).getTime();
        filteredUsers = filteredUsers.filter(u => {
            const data = pollDataMap.get(u.id);
            if (!data?.firstVoteDate) return false;
            return new Date(data.firstVoteDate).getTime() >= start;
        });
    }

    // Filter by End Date
    if (endDate) {
        // Add 1 day to include the entire end date selected
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1);
        const endTime = end.getTime();

        filteredUsers = filteredUsers.filter(u => {
            const data = pollDataMap.get(u.id);
            if (!data?.firstVoteDate) return false;
            return new Date(data.firstVoteDate).getTime() < endTime;
        });
    }

    if (error) return <div>Error loading users: {error.message}</div>;

    return (
        <div className="max-w-6xl mx-auto p-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-4xl font-black">Users</h1>
                <Link href="/admin/users/new" className="bg-black text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:scale-105 transition-transform">
                    <Plus size={20} />
                    New User
                </Link>
            </div>

            <UserFilters />

            <UserListWithSelection
                users={filteredUsers}
                profiles={profiles}
                currentUserRole={currentUserRole}
                pollDataMapArray={Array.from(pollDataMap.entries())}
            />
        </div>
    );
}
