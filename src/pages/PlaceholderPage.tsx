interface Props { title: string; icon: string; }

export default function PlaceholderPage({ title, icon }: Props) {
  return (
    <div className="p-6 animate-fadeIn">
      <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
        <span className="text-6xl block mb-4">{icon}</span>
        <h1 className="text-2xl font-extrabold text-gray-800 mb-2">{title}</h1>
        <p className="text-gray-400">Cette section est en cours de développement.</p>
      </div>
    </div>
  );
}
