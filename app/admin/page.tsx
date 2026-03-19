import Link from "next/link";
import { getServerSupabase } from "@/lib/supabaseServer";

export default async function AdminDashboard() {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
            <h1 className="text-5xl font-black mb-4">Welcome, Admin</h1>
            <p className="text-gray-500 mb-12 text-xl">What would you like to manage today?</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-6xl">
                <Link
                    href="/admin/users"
                    className="group bg-white p-12 rounded-3xl border-2 border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)] hover:translate-y-[-4px] hover:shadow-[12px_12px_0_0_rgba(0,0,0,1)] transition-all"
                >
                    <h2 className="text-3xl font-black mb-4 group-hover:underline">Users 👥</h2>
                    <p className="text-gray-600">Manage user accounts, roles, and permissions.</p>
                </Link>

                <Link
                    href="/admin/polls"
                    className="group bg-white p-12 rounded-3xl border-2 border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)] hover:translate-y-[-4px] hover:shadow-[12px_12px_0_0_rgba(0,0,0,1)] transition-all"
                >
                    <h2 className="text-3xl font-black mb-4 group-hover:underline">Polls 📝</h2>
                    <p className="text-gray-600">Create, edit, and delete game polls.</p>
                </Link>

                <Link
                    href="/admin/stages"
                    className="group bg-white p-12 rounded-3xl border-2 border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)] hover:translate-y-[-4px] hover:shadow-[12px_12px_0_0_rgba(0,0,0,1)] transition-all"
                >
                    <h2 className="text-3xl font-black mb-4 group-hover:underline">Stages 🏆</h2>
                    <p className="text-gray-600">Configure Stage Titles and Bonus Points.</p>
                </Link>

                <Link
                    href="/admin/levels"
                    className="group bg-white p-12 rounded-3xl border-2 border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)] hover:translate-y-[-4px] hover:shadow-[12px_12px_0_0_rgba(0,0,0,1)] transition-all"
                >
                    <h2 className="text-3xl font-black mb-4 group-hover:underline">Levels 🆙</h2>
                    <p className="text-gray-600">Manage Level Up pages content.</p>
                </Link>

                <Link
                    href="/admin/repository"
                    className="group bg-white p-12 rounded-3xl border-2 border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)] hover:translate-y-[-4px] hover:shadow-[12px_12px_0_0_rgba(0,0,0,1)] transition-all"
                >
                    <h2 className="text-3xl font-black mb-4 group-hover:underline">Repository 🗂️</h2>
                    <p className="text-gray-600">Manage images, videos, and audio assets used across the app.</p>
                </Link>

                <Link
                    href="/admin/map"
                    className="group bg-white p-12 rounded-3xl border-2 border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)] hover:translate-y-[-4px] hover:shadow-[12px_12px_0_0_rgba(0,0,0,1)] transition-all"
                >
                    <h2 className="text-3xl font-black mb-4 group-hover:underline">Map 🗺️</h2>
                    <p className="text-gray-600">Visual overview of the game path — all stages, levels, and branches.</p>
                </Link>
            </div>

            <p className="mt-12 text-sm text-gray-400">
                Logged in as: <span className="text-black font-bold">{user?.email}</span>
            </p>
        </div>
    );
}
