import React, { useState } from 'react';
import { Shield, Lock, Mail, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { apiFetch } from '@/services/apiClient';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || `Server error: ${res.status}`);
      }

      login(data.token, data.user);
      toast.success('Successfully logged into SOC Command Center');
    } catch (err: any) {
      console.error('Login error:', err);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] p-4 relative overflow-hidden">
      {/* Futuristic Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20 pointer-events-none">
         <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/20 blur-[120px] rounded-full" />
         <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full" />
      </div>

      <Card className="w-full max-w-md bg-black/40 border-cyan-500/20 backdrop-blur-xl z-10 shadow-2xl shadow-cyan-500/5">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-cyan-500/10 rounded-2xl flex items-center justify-center border border-cyan-500/30 shadow-lg shadow-cyan-500/20 group">
            <Shield className="w-8 h-8 text-cyan-400 group-hover:scale-110 transition-transform" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tighter text-white uppercase">GuardianSOC</CardTitle>
            <CardDescription className="text-cyan-500/60 font-mono text-[10px] uppercase tracking-widest mt-1">Enterprise Command Center v4.2</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-cyan-500/70 tracking-tighter ml-1">Terminal ID (Email)</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500/40" />
                <Input 
                  type="email" 
                  placeholder="name@guardiansoc.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-black/50 border-cyan-500/20 text-white pl-10 h-12 focus:border-cyan-400/50 transition-all placeholder:text-cyan-500/20"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-cyan-500/70 tracking-tighter ml-1">Access Protocol (Password)</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500/40" />
                <Input 
                  type="password" 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-black/50 border-cyan-500/20 text-white pl-10 h-12 focus:border-cyan-400/50 transition-all placeholder:text-cyan-500/20"
                  required
                />
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white h-12 font-bold uppercase tracking-widest text-xs transition-all shadow-lg shadow-cyan-600/20"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Authorize Access"
              )}
            </Button>
            <div className="text-center">
               <p className="text-[9px] text-cyan-500/30 uppercase tracking-tighter">Authorized personnel only. All access is logged and monitored.</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
