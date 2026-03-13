import { createContext, useContext, useState, type ReactNode } from 'react';
import type { KycData } from '../types';

interface KycContextType {
  step: number;
  setStep: (n: number) => void;
  kycData: Partial<KycData>;
  updateKycData: (data: Partial<KycData>) => void;
  resetKyc: () => void;
}

const KycContext = createContext<KycContextType | undefined>(undefined);

// TODO KYC-01 : implémenter le flux KYC complet (capture, OCR, liveness)
export function KycProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState(0);
  const [kycData, setKycData] = useState<Partial<KycData>>({});

  const updateKycData = (data: Partial<KycData>) => {
    setKycData((prev: Partial<KycData>) => ({ ...prev, ...data }));
  };

  const resetKyc = () => {
    setStep(0);
    setKycData({});
  };

  return (
    <KycContext.Provider value={{ step, setStep, kycData, updateKycData, resetKyc }}>
      {children}
    </KycContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useKyc = () => {
  const context = useContext(KycContext);
  if (context === undefined) {
    throw new Error('useKyc must be used within a KycProvider');
  }
  return context;
};
