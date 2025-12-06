import { useState, useRef, useEffect, ReactNode } from "react";
import { TabsList } from "@/components/ui/tabs";

interface ScrollableTabsListProps {
  children: ReactNode;
  className?: string;
}

export function ScrollableTabsList({ children, className = "" }: ScrollableTabsListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(true);

  const checkScrollPosition = () => {
    const el = scrollRef.current;
    if (!el) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const threshold = 10;
    
    setShowLeftFade(scrollLeft > threshold);
    setShowRightFade(scrollLeft < scrollWidth - clientWidth - threshold);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    checkScrollPosition();
    el.addEventListener("scroll", checkScrollPosition);
    window.addEventListener("resize", checkScrollPosition);

    return () => {
      el.removeEventListener("scroll", checkScrollPosition);
      window.removeEventListener("resize", checkScrollPosition);
    };
  }, []);

  return (
    <div className="relative md:contents">
      {/* Left fade indicator */}
      <div 
        className={`
          absolute left-0 top-0 bottom-6 w-6 z-10
          bg-gradient-to-r from-background to-transparent 
          pointer-events-none md:hidden
          transition-opacity duration-200
          ${showLeftFade ? 'opacity-100' : 'opacity-0'}
        `}
      />
      
      <TabsList
        ref={scrollRef as any}
        className={`
          flex overflow-x-auto scrollbar-hide gap-1 w-full mb-6 p-1
          md:grid md:w-auto md:mx-auto ${className}
        `}
      >
        {children}
      </TabsList>
      
      {/* Right fade indicator */}
      <div 
        className={`
          absolute right-0 top-0 bottom-6 w-6 z-10
          bg-gradient-to-l from-background to-transparent 
          pointer-events-none md:hidden
          transition-opacity duration-200
          ${showRightFade ? 'opacity-100' : 'opacity-0'}
        `}
      />
    </div>
  );
}
