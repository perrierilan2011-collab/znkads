import Link from "next/link";

export default function Logo({ href = "/" }) {
  return (
    <Link href={href} className="logo" aria-label="ZNK Ads — accueil">
      <span className="logo-mark">Z</span>
      <span className="logo-text">
        ZNK <span>Ads</span>
      </span>
    </Link>
  );
}
