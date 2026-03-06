import { createContext, useContext, useState, ReactNode } from 'react';

export type KYCState = 'DRAFT' | 'PENDING_INFO' | 'PENDING_KYC' | 'REJECTED' | 'ACTIVATED' | 'LOCKED_LIVENESS';
export type AccessLevel = 'RESTRICTED' | 'LIMITED' | 'PRE_FULL' | 'FULL' | 'DISABLED';

interface ScenarioState {
    isOffline: boolean;
    kycState: KYCState;
    accessLevel: AccessLevel;
    ocrConfidenceLow: boolean;
    amlAlertActive: boolean;
    batchError: boolean;
    setScenario: (updates: Partial<ScenarioState>) => void;
    resetScenarios: () => void;
}

const defaultState: Omit<ScenarioState, 'setScenario' | 'resetScenarios'> = {
    isOffline: false,
    kycState: 'DRAFT',
    accessLevel: 'RESTRICTED',
    ocrConfidenceLow: false,
    amlAlertActive: true,
    batchError: false,
};

const ScenarioContext = createContext<ScenarioState | undefined>(undefined);

export function ScenarioProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState(defaultState);

    const setScenario = (updates: Partial<ScenarioState>) => {
        setState(prev => ({ ...prev, ...updates }));
    };

    const resetScenarios = () => setState(defaultState);

    return (
        <ScenarioContext.Provider value={{ ...state, setScenario, resetScenarios }}>
            {children}
        </ScenarioContext.Provider>
    );
}

export function useScenario() {
    const context = useContext(ScenarioContext);
    if (context === undefined) {
        throw new Error('useScenario must be used within a ScenarioProvider');
    }
    return context;
}
