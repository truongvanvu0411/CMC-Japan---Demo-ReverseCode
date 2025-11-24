import React from 'react';

interface ImageFullscreenModalProps {
  imageUrl: string;
  onClose: () => void;
}

const ImageFullscreenModal: React.FC<ImageFullscreenModalProps> = ({ imageUrl, onClose }) => {
  // Effect to handle 'Escape' key press
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
      style={{ animationDuration: '0.2s' }}
    >
      <div 
        className="relative max-w-full max-h-full"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on the image
      >
        <img src={imageUrl} alt="Fullscreen view" className="block max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />
        <button 
          onClick={onClose} 
          className="absolute -top-4 -right-4 w-10 h-10 bg-slate-800 text-white rounded-full flex items-center justify-center text-2xl hover:bg-slate-700 transition-colors border-2 border-slate-600"
          aria-label="Close fullscreen view"
        >
          &times;
        </button>
      </div>
       <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default ImageFullscreenModal;
