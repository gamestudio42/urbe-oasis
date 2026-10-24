import { useContext, type ReactNode } from 'react';
import { AdobeIcon, type AdobeControlId } from './adobeIcons';
import { IconStyleContext } from './iconStyle';

/** Host-selected icons; existing shells keep their original control content. */
export function InterfaceIcon({
  id,
  fallback = null,
}: {
  id: AdobeControlId;
  fallback?: ReactNode;
}) {
  const style = useContext(IconStyleContext);
  return style === 'adobe' ? <AdobeIcon id={id} size={20} /> : fallback;
}
