import classNames from 'classnames';
import { ReactNode } from 'react';

interface EyebrowProps {
  tone?: 'accent' | 'neutral';
  children: ReactNode;
  className?: string;
}

export default function Eyebrow({ tone = 'accent', children, className }: EyebrowProps) {
  return (
    <span className={classNames('eyebrow', tone === 'neutral' && 'neutral', className)}>
      {children}
    </span>
  );
}
