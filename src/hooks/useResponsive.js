import { useState, useEffect } from 'react';
import { theme } from '../styles/theme';

export function useResponsive() {
  const [state, setState] = useState({ isMobile: false, isTablet: false, isDesktop: true });

  useEffect(() => {
    const mobileQuery = window.matchMedia(`(max-width: ${theme.breakpoints.mobile})`);
    const tabletQuery = window.matchMedia(`(min-width: ${theme.breakpoints.mobile}) and (max-width: ${theme.breakpoints.tablet})`);

    const update = () => {
      const mobile = mobileQuery.matches;
      const tablet = tabletQuery.matches;
      setState({ isMobile: mobile, isTablet: tablet, isDesktop: !mobile && !tablet });
    };

    update();
    mobileQuery.addEventListener('change', update);
    tabletQuery.addEventListener('change', update);
    return () => {
      mobileQuery.removeEventListener('change', update);
      tabletQuery.removeEventListener('change', update);
    };
  }, []);

  return state;
}
