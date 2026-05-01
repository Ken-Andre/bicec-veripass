import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenLayout } from '../../components/ScreenLayout';
import { Zap, Droplets, Camera, Upload, FileImage, AlertCircle } from 'lucide-react';

type BillType = 'ENEO' | 'CAMWATER';
type CaptureMode = 'camera' | 'upload';

const MAX_FILE_SIZE_MB = 1;

const BILL_OPTIONS: {
  type: BillType;
  label: string;
  sublabel: string;
  icon: typeof Zap;
  color: string;
  borderColor: string;
  bgColor: string;
  available: boolean;
}[] = [
  {
    type: 'ENEO',
    label: 'ENEO',
    sublabel: 'Facture electricite',
    icon: Zap,
    color: 'text-yellow-600',
    borderColor: 'border-yellow-400',
    bgColor: 'bg-yellow-50',
    available: true,
  },
  {
    type: 'CAMWATER',
    label: 'CAMWATER',
    sublabel: 'Facture eau',
    icon: Droplets,
    color: 'text-blue-600',
    borderColor: 'border-blue-400',
    bgColor: 'bg-blue-50',
    available: false,
  },
];

export default function BillTypeSelectScreen() {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<BillType>('ENEO');

  const handleContinue = (mode: CaptureMode) => {
    if (mode === 'camera') {
      navigate('/kyc/bill-capture', { state: { billType: selectedType } });
    } else {
      navigate('/kyc/bill-upload', { state: { billType: selectedType } });
    }
  };

  return (
    <ScreenLayout title="Facture" showBack>
      <div className="flex flex-col gap-6 py-6 w-full max-w-sm mx-auto">
        {/* Header */}
        <div className="text-center">
          <FileImage className="w-12 h-12 mx-auto text-primary mb-3" />
          <h2 className="text-xl font-bold text-slate-800">Justificatif de domicile</h2>
          <p className="text-sm text-slate-500 mt-1">
            Televersez ou prenez une photo de votre facture pour prouver votre adresse.
          </p>
        </div>

        {/* Bill type selection */}
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-slate-700">Type de facture</p>
          {BILL_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedType === option.type;
            return (
              <button
                key={option.type}
                onClick={() => option.available && setSelectedType(option.type)}
                disabled={!option.available}
                className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left
                  ${isSelected ? `${option.borderColor} ${option.bgColor}` : 'border-slate-200 bg-white'}
                  ${!option.available ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]'}
                `}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isSelected ? option.bgColor : 'bg-slate-100'}`}>
                  <Icon className={`w-6 h-6 ${isSelected ? option.color : 'text-slate-400'}`} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-800">{option.label}</p>
                  <p className="text-sm text-slate-500">{option.sublabel}</p>
                </div>
                {!option.available && (
                  <span className="text-xs bg-slate-200 text-slate-500 px-2 py-1 rounded-full font-medium">
                    Bientot
                  </span>
                )}
                {isSelected && option.available && (
                  <div className={`w-6 h-6 rounded-full ${option.borderColor} border-2 flex items-center justify-center`}>
                    <div className={`w-3 h-3 rounded-full ${option.color.replace('text-', 'bg-')}`} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* File size info */}
        <div className="flex items-start gap-3 bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-200">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Taille maximale : {MAX_FILE_SIZE_MB} Mo</p>
            <p className="text-blue-600 mt-1">Formats acceptes : JPG, PNG, PDF</p>
            <p className="text-blue-600 mt-1">Les images sont optimisees automatiquement.</p>
          </div>
        </div>

        {/* Capture mode buttons */}
        <div className="flex flex-col gap-3 mt-2">
          <p className="text-sm font-semibold text-slate-700">Comment souhaitez-vous fournir votre facture ?</p>

          <button
            onClick={() => handleContinue('camera')}
            className="flex items-center gap-4 w-full h-16 rounded-2xl bg-slate-900 text-white font-semibold px-6 hover:bg-slate-800 transition-colors active:scale-[0.98]"
          >
            <Camera className="w-6 h-6" />
            <div className="text-left">
              <p className="font-bold">Prendre une photo</p>
              <p className="text-xs text-white/60 font-normal">Avec la camera de votre telephone</p>
            </div>
          </button>

          <button
            onClick={() => handleContinue('upload')}
            className="flex items-center gap-4 w-full h-16 rounded-2xl bg-white border-2 border-slate-200 text-slate-800 font-semibold px-6 hover:bg-slate-50 transition-colors active:scale-[0.98]"
          >
            <Upload className="w-6 h-6" />
            <div className="text-left">
              <p className="font-bold">Importer un fichier</p>
              <p className="text-xs text-slate-500 font-normal">Photo ou scan depuis votre galerie</p>
            </div>
          </button>
        </div>
      </div>
    </ScreenLayout>
  );
}
