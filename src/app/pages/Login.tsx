import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Glasses } from 'lucide-react';
import { toast } from 'sonner';

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (error) {
      toast.error('Connexion échouée', { description: (error as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen min-h-svh bg-gray-50">
      {/* Panneau de marque */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-navy p-8 text-white lg:flex xl:p-12">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-brand/5 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-brand/50 bg-brand/10">
            <Glasses className="h-6 w-6 text-brand" />
          </div>
          <div className="leading-tight">
            <p className="font-display text-3xl font-medium tracking-wide">Merkey</p>
            <p className="text-[11px] tracking-[0.18em] uppercase text-gray-400">
              Lunetterie · Kinshasa
            </p>
          </div>
        </div>

        <div className="relative max-w-md">
          <p className="mb-4 text-xs font-semibold tracking-[0.2em] uppercase text-brand">
            Gestion de stock &amp; ventes
          </p>
          <h1 className="font-display text-5xl font-medium leading-tight">
            Gérez vos boutiques avec élégance.
          </h1>
          <p className="mt-4 text-lg text-gray-300">
            Approvisionnement, répartition entre boutiques et ventes en USD, au cœur de la RDC.
          </p>
        </div>

        <p className="relative text-sm text-gray-500">© Merkey — République Démocratique du Congo</p>
      </aside>

      {/* Formulaire */}
      <main className="flex flex-1 flex-col items-center justify-start overflow-y-auto px-4 py-8 sm:justify-center sm:p-8">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-brand/50 bg-brand/10">
              <Glasses className="h-6 w-6 text-brand" />
            </div>
            <div className="leading-tight">
              <p className="font-display text-2xl font-medium text-navy">Merkey</p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">
                Lunetterie · Kinshasa
              </p>
            </div>
          </div>

          <Card className="border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="font-display text-2xl text-navy sm:text-3xl">
                Connexion
              </CardTitle>
              <p className="text-sm text-gray-500">Accédez à votre espace de gestion</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password">Mot de passe</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  variant="brand"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? 'Connexion…' : 'Se connecter'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}