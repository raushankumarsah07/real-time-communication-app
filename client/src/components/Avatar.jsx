const COLORS = ['#ffb347', '#ff6b81', '#5ee2a0', '#7aa7ff', '#c48bff', '#4fd8e8'];

export default function Avatar({ name = '?', size = 40 }) {
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.42, background: COLORS[hash % COLORS.length] }}
      aria-hidden="true"
    >
      {name[0]?.toUpperCase()}
    </span>
  );
}
