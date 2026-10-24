import { createContext } from 'react';
import type { ThemeStyle } from '@theme/core';

/** Stable across component-only development refreshes. */
export const IconStyleContext = createContext<ThemeStyle>('classic');
