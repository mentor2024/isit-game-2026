"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Eye, Edit, Trash2 } from "lucide-react";
import { deleteUser, bulkDeleteUsers } from "@/app/admin/actions";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import { useRouter } from "next/navigation";

interface UserListWithSelectionProps {
    users: any[];
    profiles: any[];
    currentUserRole: string | null;
    pollDataMapArray: [string, any][]; // Passing map as array of entries
}

export default function UserListWithSelection({ users, profiles, currentUserRole, pollDataMapArray }: UserListWithSelectionProps) {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isDeleting, startTransition] = useTransition();
    const router = useRouter();

    const isSuperAdmin = currentUserRole === 'superadmin';
    const pollDataMap = new Map(pollDataMapArray);

    const toggleSelectAll = () => {
        if (selectedIds.length === users.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(users.map(u => u.id));
        }
    };

    const toggleSelect = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const handleBulkDelete = () => {
        if (!confirm(`Are you sure you want to delete ${selectedIds.length} users? This action cannot be undone.`)) {
            return;
        }

        startTransition(async () => {
            try {
                const res = await bulkDeleteUsers(selectedIds);
                if (res?.success) {
                    setSelectedIds([]);
                    router.refresh();
                }
            } catch (e: any) {
                alert("Failed to delete users: " + e.message);
            }
        });
    };

    return (
        <div className="relative">
            {isSuperAdmin && selectedIds.length > 0 && (
                <div className="bg-white border-2 border-red-500 rounded-xl p-4 mb-4 flex justify-between items-center shadow-lg sticky top-4 z-10 transition-all animate-in fade-in slide-in-from-top-4">
                    <span className="font-bold text-red-600">{selectedIds.length} user(s) selected</span>
                    <button
                        onClick={handleBulkDelete}
                        disabled={isDeleting}
                        className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <Trash2 size={16} />
                        {isDeleting ? "Deleting..." : "Bulk Delete"}
                    </button>
                </div>
            )}

            <div className="bg-white rounded-3xl shadow-[0_8px_0_0_rgba(0,0,0,1)] border-2 border-black overflow-hidden relative">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b-2 border-black">
                                {isSuperAdmin && (
                                    <th className="p-4 w-12 text-center border-r border-gray-200">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black cursor-pointer"
                                            checked={selectedIds.length === users.length && users.length > 0}
                                            onChange={toggleSelectAll}
                                        />
                                    </th>
                                )}
                                <th className="p-4 font-bold">Avatar</th>
                                <th className="p-4 font-bold">Username</th>
                                <th className="p-4 font-bold">Email</th>
                                <th className="p-4 font-bold">Role</th>
                                <th className="p-4 font-bold">Score</th>
                                <th className="p-4 font-bold">First Poll</th>
                                <th className="p-4 font-bold">Last Poll</th>
                                <th className="p-4 font-bold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => {
                                const profile = profiles.find(p => p.id === u.id);
                                const userRole = profile?.role || 'user';
                                const username = profile?.avatar_name || '-';
                                const avatarUrl = profile?.avatar_image;
                                const score = profile?.score || 0;
                                const pollData: any = pollDataMap.get(u.id);
                                const lastVote: any = pollData?.lastVote;

                                const canManage = (currentUserRole === 'superadmin') || (currentUserRole === 'admin' && userRole === 'user');
                                const isSelected = selectedIds.includes(u.id);

                                return (
                                    <tr key={u.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-red-50 hover:bg-red-50' : ''}`}>
                                        {isSuperAdmin && (
                                            <td className="p-4 text-center border-r border-gray-200" onClick={(e) => {
                                                // Prevent double toggle if clicking the checkbox directly
                                                if ((e.target as HTMLElement).tagName !== 'INPUT') {
                                                    toggleSelect(u.id);
                                                }
                                            }}>
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black cursor-pointer"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelect(u.id)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </td>
                                        )}
                                        <td className="p-4">
                                            {avatarUrl ? (
                                                <img src={avatarUrl} alt={username} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 font-bold text-xs">
                                                    ?
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 font-medium text-gray-700">{username}</td>
                                        <td className="p-4 font-medium">{u.email}</td>
                                        <td className="p-4">
                                            <span className={`text-xs px-2 py-1 rounded border font-bold uppercase ${userRole === 'superadmin' ? 'bg-purple-100 border-purple-300 text-purple-700' :
                                                userRole === 'admin' ? 'bg-blue-100 border-blue-300 text-blue-700' :
                                                    'bg-gray-100 border-gray-300 text-gray-700'
                                                }`}>
                                                {userRole}
                                            </span>
                                        </td>
                                        <td className="p-4 font-bold text-yellow-600">
                                            {score > 0 && <span>⭐️</span>} {score}
                                        </td>
                                        <td className="p-4 text-xs font-mono text-gray-500">
                                            {pollData?.firstVoteDate ? (
                                                <span className="font-bold text-gray-700">
                                                    {format(new Date(pollData.firstVoteDate), 'MMM d, yyyy')}
                                                </span>
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-xs font-mono text-gray-500">
                                            {lastVote ? (
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-black truncate max-w-[150px]" title={lastVote.polls?.title}>
                                                        {lastVote.polls?.title}
                                                    </span>
                                                    <span>
                                                        Stage {lastVote.polls?.stage} &gt; Level {lastVote.polls?.level}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                        </td>
                                        <td className="p-4 flex justify-end gap-2">
                                            <Link href={`/admin/users/${u.id}`} className="p-2 text-gray-500 hover:text-black hover:bg-gray-200 rounded-lg transition-colors" title="View">
                                                <Eye size={18} />
                                            </Link>

                                            {canManage && (
                                                <>
                                                    <Link href={`/admin/users/${u.id}/edit`} className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                                                        <Edit size={18} />
                                                    </Link>
                                                    <ConfirmDeleteButton
                                                        action={deleteUser}
                                                        itemId={u.id}
                                                        itemType="user"
                                                        fieldName="userId"
                                                    />
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
