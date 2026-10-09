import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import {
  DEFAULT_FORECAST_OPTIONS,
  FORECAST_STATUS_LABEL,
  type ForecastOptions,
  type ForecastStatus,
} from '../lib/forecasting';
import { useForecast } from '../hooks/useForecast';

function StatusBadge({ status }: { status: ForecastStatus }) {
  const map: Record<ForecastStatus, string> = {
    rupture: 'bg-red-100 text-red-700',
    critique: 'bg-orange-100 text-orange-700',
    a_commander: 'bg-yellow-100 text-yellow-700',
    ok: 'bg-green-100 text-green-700',
  };
  return <Badge className={map[status]}>{FORECAST_STATUS_LABEL[status]}</Badge>;
}

export function Predictions() {
  const [options, setOptions] = useState<ForecastOptions>(DEFAULT_FORECAST_OPTIONS);
  const { forecasts, isLoading } = useForecast(options);

  const alerts = forecasts.filter((f) => f.status !== 'ok');

  const update = (patch: Partial<ForecastOptions>) =>
    setOptions((prev) => ({ ...prev, ...patch }));

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Alerte prédictive de rupture</h1>
        <p className="text-gray-500 mt-1">
          Point de commande dynamique calculé à partir de la consommation récente
        </p>
      </div>

      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label htmlFor="window">Fenêtre d'analyse (jours)</Label>
              <Input
                id="window"
                type="number"
                min="1"
                value={options.windowDays}
                onChange={(e) => update({ windowDays: Math.max(1, parseInt(e.target.value) || 1) })}
              />
            </div>
            <div>
              <Label htmlFor="lead">Délai de réapprovisionnement (jours)</Label>
              <Input
                id="lead"
                type="number"
                min="0"
                value={options.leadTimeDays}
                onChange={(e) =>
                  update({ leadTimeDays: Math.max(0, parseInt(e.target.value) || 0) })
                }
              />
            </div>
            <div>
              <Label htmlFor="service">Niveau de service</Label>
              <select
                id="service"
                value={options.serviceLevel}
                onChange={(e) => update({ serviceLevel: parseFloat(e.target.value) })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value={0.9}>90 %</option>
                <option value={0.95}>95 %</option>
                <option value={0.975}>97,5 %</option>
                <option value={0.99}>99 %</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {alerts.length > 0 && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{alerts.length} produit(s) nécessitent une action</AlertTitle>
          <AlertDescription>
            Le stock est au niveau ou en dessous du point de commande prédictif.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            Prévisions par produit
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-gray-500">Chargement des prévisions…</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Conso / jour</TableHead>
                    <TableHead>Écart-type</TableHead>
                    <TableHead>Stock sécurité</TableHead>
                    <TableHead>Point de commande</TableHead>
                    <TableHead>Jours de stock</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {forecasts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-gray-500">
                        Aucun produit
                      </TableCell>
                    </TableRow>
                  ) : (
                    forecasts.map((f) => (
                      <TableRow key={f.productId}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{f.name}</p>
                            <p className="text-sm text-gray-500">{f.sku}</p>
                          </div>
                        </TableCell>
                        <TableCell>{f.stock}</TableCell>
                        <TableCell>{f.avgDailyDemand.toFixed(2)}</TableCell>
                        <TableCell>{f.demandStdDev.toFixed(2)}</TableCell>
                        <TableCell>{f.safetyStock.toFixed(1)}</TableCell>
                        <TableCell className="font-semibold">{f.reorderPoint}</TableCell>
                        <TableCell>
                          {Number.isFinite(f.daysOfStock) ? f.daysOfStock.toFixed(1) : '∞'}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={f.status} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}