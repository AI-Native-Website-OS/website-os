'use client';

interface FieldHintProps {
  text: string[];
}

export default function FieldHint({ text }: FieldHintProps) {
  return (
    <span className="relative inline-flex items-center group align-middle ml-1">
      <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-300 text-white text-[10px] font-bold cursor-help select-none">
        ?
      </span>
      <span className="absolute left-0 top-full mt-1.5 w-72 bg-gray-900 text-white text-xs rounded-md p-3 shadow-lg z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 pointer-events-none whitespace-pre-line">
        {text.map((line, i) => (
          <div key={i} className="leading-relaxed">{line}</div>
        ))}
      </span>
    </span>
  );
}
