import React from 'react';

export const HeaderPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div className="flex items-center gap-2">{children}</div>;
};
