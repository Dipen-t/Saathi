"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

type AlertType = 'info' | 'confirm' | 'destructive';

interface AlertOptions {
  title: string;
  message: string;
  type?: AlertType;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface AlertContextType {
  showAlert: (options: AlertOptions) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlert must be used within an AlertProvider");
  }
  return context;
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alertState, setAlertState] = useState<AlertOptions | null>(null);

  const showAlert = (options: AlertOptions) => {
    setAlertState(options);
  };

  const closeAlert = () => {
    setAlertState(null);
  };

  const handleConfirm = () => {
    if (alertState?.onConfirm) alertState.onConfirm();
    closeAlert();
  };

  const handleCancel = () => {
    if (alertState?.onCancel) alertState.onCancel();
    closeAlert();
  };

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      
      {/* Global Alert Modal */}
      {alertState && (
        <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200 text-center">
            <h3 className="font-bold text-lg text-[#111827] mb-2">{alertState.title}</h3>
            <p className="text-[#4B5563] text-[15px] mb-6">{alertState.message}</p>
            
            {alertState.type === 'confirm' || alertState.type === 'destructive' ? (
              <div className="flex gap-3">
                <button 
                  onClick={handleCancel}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 rounded-xl text-[15px] transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirm}
                  className={`flex-1 font-bold py-3 rounded-xl text-[15px] transition-colors text-white ${
                    alertState.type === 'destructive' 
                      ? 'btn-confirm-destructive' 
                      : 'btn-confirm-primary'
                  }`}
                >
                  Confirm
                </button>
              </div>
            ) : (
              <button 
                onClick={closeAlert}
                className="w-full bg-[#111827] hover:bg-black text-white font-bold py-3 rounded-xl text-[15px] transition-colors"
              >
                Got it
              </button>
            )}
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
}
