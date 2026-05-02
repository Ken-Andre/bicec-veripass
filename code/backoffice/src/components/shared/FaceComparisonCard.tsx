import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

function getToken(): string | null {
  try { return localStorage.getItem('veripass_access_token'); } catch { return null; }
}

interface FaceComparisonCardProps {
  sessionId: string;
  selfieDocId: string;
  cniRectoDocId: string;
  faceMatchScore?: number | null;
}

export function FaceComparisonCard({ sessionId, selfieDocId, cniRectoDocId, faceMatchScore }: FaceComparisonCardProps) {
  const [selfieError, setSelfieError] = useState(false);
  const [cniError, setCniError] = useState(false);
  const token = getToken();

  const selfieUrl = token
    ? `${API_BASE}/backoffice/dossier/${sessionId}/documents/${selfieDocId}/file`
    : null;
  const cniUrl = token
    ? `${API_BASE}/backoffice/dossier/${sessionId}/documents/${cniRectoDocId}/file`
    : null;

  const scoreColor = faceMatchScore != null
    ? faceMatchScore >= 0.85 ? 'text-green-600' : faceMatchScore >= 0.6 ? 'text-yellow-600' : 'text-red-600'
    : 'text-muted-foreground';

  const scoreBadge = faceMatchScore != null
    ? faceMatchScore >= 0.85 ? 'default' : faceMatchScore >= 0.6 ? 'secondary' : 'destructive'
    : 'outline';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Comparaison Visage / CNI</CardTitle>
          {faceMatchScore != null && (
            <Badge variant={scoreBadge as any}>
              Match: {(faceMatchScore * 100).toFixed(0)}%
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {/* Selfie */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground text-center font-medium">Selfie (Liveness)</p>
            <div className="aspect-square rounded-lg overflow-hidden border bg-muted flex items-center justify-center">
              {selfieUrl && !selfieError ? (
                <img
                  src={selfieUrl}
                  alt="Selfie liveness"
                  className="w-full h-full object-cover"
                  crossOrigin="use-credentials"
                  onError={() => setSelfieError(true)}
                />
              ) : (
                <span className="text-xs text-muted-foreground">Image indisponible</span>
              )}
            </div>
          </div>

          {/* CNI Recto */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground text-center font-medium">CNI Recto</p>
            <div className="aspect-square rounded-lg overflow-hidden border bg-muted flex items-center justify-center">
              {cniUrl && !cniError ? (
                <img
                  src={cniUrl}
                  alt="CNI Recto"
                  className="w-full h-full object-cover"
                  crossOrigin="use-credentials"
                  onError={() => setCniError(true)}
                />
              ) : (
                <span className="text-xs text-muted-foreground">Image indisponible</span>
              )}
            </div>
          </div>
        </div>

        {/* Match score bar */}
        {faceMatchScore != null && (
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Score de correspondance</span>
              <span className={`font-mono font-bold ${scoreColor}`}>
                {(faceMatchScore * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  faceMatchScore >= 0.85 ? 'bg-green-500' : faceMatchScore >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(faceMatchScore * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
