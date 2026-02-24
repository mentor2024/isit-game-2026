"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";

export default function BackToPollsLink() {
    const [href, setHref] = useState("/admin/polls");

    useEffect(() => {
        const saved = sessionStorage.getItem("pollsFilterUrl");
        if (saved) setHref(saved);
    }, []);

    return (
        <Link href={href} className="flex items-center gap-2 text-gray-500 hover:text-black mb-6 font-bold">
            <ArrowLeft size={20} />
            Back to Polls
        </Link>
    );
}
