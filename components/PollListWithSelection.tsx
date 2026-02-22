"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Eye, Edit, Play, Trash2 } from "lucide-react";
import { deletePoll, bulkDeletePolls } from "@/app/admin/poll-actions";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import ClonePollButton from "@/components/ClonePollButton";
import EditableHierarchyCell from "@/components/EditableHierarchyCell";
import { useRouter } from "next/navigation";

interface PollListWithSelectionProps {
    polls: any[];
    userRole: string | null;
    searchParams: any;
    sortBy: string;
    sortOrder: string;
}

export default function PollListWithSelection({ polls, userRole, searchParams, sortBy, sortOrder }: PollListWithSelectionProps) {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isDeleting, startTransition] = useTransition();
    const router = useRouter();

    const isSuperAdmin = userRole === 'superadmin';

    const getSortUrl = (col: string) => {
        const newOrder = sortBy === col && sortOrder === 'asc' ? 'desc' : 'asc';
        const p = new URLSearchParams();
        if (searchParams?.stage) p.set('stage', searchParams.stage);
        if (searchParams?.level) p.set('level', searchParams.level);
        if (searchParams?.poll_order) p.set('poll_order', searchParams.poll_order);
        if (searchParams?.type) p.set('type', searchParams.type);
        if (searchParams?.search) p.set('search', searchParams.search);
        p.set('sort_by', col);
        p.set('sort_order', newOrder);
        return `?${p.toString()}`;
    };

    const SortIcon = ({ col }: { col: string }) => {
        if (sortBy !== col) return <span className="text-gray-300 ml-1 text-[10px]">↕</span>;
        return sortOrder === 'asc' ? <span className="ml-1 text-xs">↑</span> : <span className="ml-1 text-xs">↓</span>;
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === polls.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(polls.map(p => p.id));
        }
    };

    const toggleSelect = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedIds.length} polls? This action cannot be undone.`)) {
            return;
        }

        startTransition(async () => {
            try {
                const res = await bulkDeletePolls(selectedIds);
                if (res?.success) {
                    setSelectedIds([]);
                    router.refresh();
                }
            } catch (e: any) {
                alert("Failed to delete polls: " + e.message);
            }
        });
    };

    return (
        <div className="relative">
            {isSuperAdmin && selectedIds.length > 0 && (
                <div className="bg-white border-2 border-red-500 rounded-xl p-4 mb-4 flex justify-between items-center shadow-lg sticky top-4 z-10 transition-all animate-in fade-in slide-in-from-top-4">
                    <span className="font-bold text-red-600">{selectedIds.length} poll(s) selected</span>
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

            <div className="bg-white rounded-3xl shadow-[0_8px_0_0_rgba(0,0,0,1)] border-2 border-black overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b-2 border-black text-sm">
                            {isSuperAdmin && (
                                <th className="p-3 w-12 text-center border-r border-gray-200">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 accent-red-500 cursor-pointer"
                                        checked={polls.length > 0 && selectedIds.length === polls.length}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                            )}
                            <th className="p-3 font-bold cursor-pointer hover:bg-gray-100 transition-colors">
                                <Link href={getSortUrl('type')} className="flex items-center w-full h-full">Type <SortIcon col="type" /></Link>
                            </th>
                            <th className="p-3 font-bold cursor-pointer hover:bg-gray-100 transition-colors">
                                <Link href={getSortUrl('title')} className="flex items-center w-full h-full">Title <SortIcon col="title" /></Link>
                            </th>
                            <th className="p-3 font-bold text-center cursor-pointer hover:bg-gray-100 transition-colors">
                                <Link href={getSortUrl('stage')} className="flex items-center justify-center w-full h-full">Stage <SortIcon col="stage" /></Link>
                            </th>
                            <th className="p-3 font-bold text-center cursor-pointer hover:bg-gray-100 transition-colors">
                                <Link href={getSortUrl('level')} className="flex items-center justify-center w-full h-full">Level <SortIcon col="level" /></Link>
                            </th>
                            <th className="p-3 font-bold text-center cursor-pointer hover:bg-gray-100 transition-colors">
                                <Link href={getSortUrl('poll_order')} className="flex items-center justify-center w-full h-full">Order <SortIcon col="poll_order" /></Link>
                            </th>
                            <th className="p-3 font-bold text-center">Instructions</th>
                            <th className="p-3 font-bold text-center cursor-pointer hover:bg-gray-100 transition-colors">
                                <Link href={getSortUrl('created_at')} className="flex items-center justify-center w-full h-full">Created <SortIcon col="created_at" /></Link>
                            </th>
                            <th className="p-3 font-bold text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {polls?.map((poll) => (
                            <tr key={poll.id} className="border-b border-gray-100 hover:bg-gray-50 text-sm">
                                {isSuperAdmin && (
                                    <td className="p-3 text-center border-r border-gray-100">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 accent-red-500 cursor-pointer"
                                            checked={selectedIds.includes(poll.id)}
                                            onChange={() => toggleSelect(poll.id)}
                                        />
                                    </td>
                                )}
                                <td className="p-3">
                                    <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${poll.type === "isit_image"
                                        ? "bg-blue-100 text-blue-800 border border-blue-200"
                                        : poll.type === "quad_sorting"
                                            ? "bg-purple-100 text-purple-800 border border-purple-200"
                                            : poll.type === "multiple_choice"
                                                ? "bg-green-100 text-green-800 border border-green-200"
                                                : "bg-gray-100 text-gray-800 border border-gray-200"
                                        }`}>
                                        {poll.type === "isit_image"
                                            ? "ISIT Image"
                                            : poll.type === "quad_sorting"
                                                ? "Quad Sort"
                                                : poll.type === "multiple_choice"
                                                    ? "Multi-choice (points)"
                                                    : poll.type === "isit_text_plus"
                                                        ? "ISIT Text Plus"
                                                        : "ISIT Text"
                                        }
                                    </span>
                                </td>
                                <td className="p-3 font-bold min-w-[240px]">{poll.title}</td>
                                <td className="p-3 bg-gray-50 text-center">
                                    <EditableHierarchyCell pollId={poll.id} field="stage" initialValue={poll.stage ?? 1} />
                                </td>
                                <td className="p-3 bg-gray-50 text-center">
                                    <EditableHierarchyCell pollId={poll.id} field="level" initialValue={poll.level || 1} />
                                </td>
                                <td className="p-3 text-center">
                                    <EditableHierarchyCell pollId={poll.id} field="poll_order" initialValue={poll.poll_order || 1} />
                                </td>
                                <td className="p-3 text-gray-500 text-xs max-w-[12rem] truncate">
                                    {poll.instructions?.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')}
                                </td>
                                <td className="p-3 text-gray-400 text-[10px] font-mono whitespace-nowrap">{new Date(poll.created_at).toLocaleDateString()}</td>
                                <td className="p-3 flex justify-end gap-2">
                                    <Link href={`/poll?preview=${poll.id}`} target="_blank" className="p-1.5 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors" title="Test / Preview">
                                        <Play size={16} />
                                    </Link>
                                    <ClonePollButton pollId={poll.id} />
                                    <Link href={`/admin/polls/${poll.id}`} className="p-1.5 text-gray-500 hover:text-black hover:bg-gray-200 rounded-lg transition-colors" title="View">
                                        <Eye size={16} />
                                    </Link>
                                    <Link href={`/admin/polls/${poll.id}/edit`} className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                                        <Edit size={16} />
                                    </Link>
                                    <ConfirmDeleteButton
                                        action={deletePoll}
                                        itemId={poll.id}
                                        itemType="poll"
                                        fieldName="pollId"
                                    />
                                </td>
                            </tr>
                        ))}
                        {(!polls || polls.length === 0) && (
                            <tr>
                                <td colSpan={isSuperAdmin ? 9 : 8} className="p-8 text-center text-gray-400 italic">No polls found. Create one!</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
