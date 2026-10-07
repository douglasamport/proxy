import Link from "next/link";

// One row in a sidebar list. With an href it's a link; without, it renders
// as a greyed-out, non-clickable entry (e.g. a site with no page built yet).
export default function SidebarItem({
  href,
  children,
}: {
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      {href ? (
        <Link
          href={href}
          className="block rounded px-2 py-1.5 hover:bg-slate-800"
        >
          {children}
        </Link>
      ) : (
        <span className="block px-2 py-1.5 text-slate-600">{children}</span>
      )}
    </li>
  );
}
