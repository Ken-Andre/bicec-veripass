/**
 * RequestInfoModal — Modal pour demander des infos/documents complémentaires
 * Source: veripass-gatekeeper prototype (src/components/shared/RequestInfoModal.tsx)
 * Mapping vers BICEC VeriPass — pour EvidenceViewerPage (Jean) → action REQUEST_INFO
 */
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Textarea } from '@/components/ui/Textarea';
import { Checkbox } from '@/components/ui/Checkbox';

interface RequestInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (message: string, fields: string[]) => Promise<void>;
  fieldNames?: string[]; // Champs OCR problématiques prédéfinis
}

export function RequestInfoModal({ open, onOpenChange, onSubmit, fieldNames }: RequestInfoModalProps) {
  const [message, setMessage] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleField = (field: string) => {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit(message, selectedFields);
      setMessage('');
      setSelectedFields([]);
      onOpenChange(false);
    } catch (err) {
      console.error('Request info failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Demander une info complémentaire</DialogTitle>
          <DialogDescription>
            Envoyez une demande à Marie pour compléter son dossier.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Champs problématiques prédéfinis */}
          {fieldNames && fieldNames.length > 0 && (
            <div>
              <label className="text-sm font-medium">Champs concernées</label>
              <div className="mt-2 space-y-2">
                {fieldNames.map((field) => (
                  <div key={field} className="flex items-center gap-2">
                    <Checkbox
                      id={field}
                      checked={selectedFields.includes(field)}
                      onChange={() => toggleField(field)}
                    />
                    <label htmlFor={field} className="text-sm">{field}</label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Message personnalisé */}
          <div>
            <label className="text-sm font-medium">Message</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex: Veuillez fournir un document plus lisible pour le champ 'date_naissance'..."
              className="mt-2 min-h-[100px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !message.trim()}>
            {loading ? 'Envoi...' : 'Envoyer la demande'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
