export function showToast(text: string, type: 'success' | 'error' = 'success', position: 'top-right' | 'top-center' = 'top-right') {
  const toast = document.createElement('div');
  const isCenter = position === 'top-center';
  const posClass = isCenter ? 'top-4 left-1/2' : 'top-4 right-8';
  toast.className = `fixed ${posClass} px-5 py-3 rounded-lg text-sm shadow-lg z-[9999] transition-all duration-300 whitespace-nowrap ${
    type === 'success' ? 'bg-black text-white' : 'bg-red-600 text-white'
  }`;
  toast.textContent = text;
  const hiddenTransform = isCenter ? 'translate(-50%, -8px)' : 'translateY(-8px)';
  const visibleTransform = isCenter ? 'translate(-50%, 0)' : 'translateY(0)';
  toast.style.opacity = '0';
  toast.style.transform = hiddenTransform;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = visibleTransform;
  });
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = hiddenTransform;
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}