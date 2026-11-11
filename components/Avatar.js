export default function Avatar({ user, size = 36 }) {
  const name = user?.display_name || user?.username || "?";
  const initials = name.slice(0, 2).toUpperCase();

  if (user?.avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatar}
        alt={name}
        width={size}
        height={size}
        className="avatar"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <span className="avatar" style={{ width: size, height: size }}>
      {initials}
    </span>
  );
}
