import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Zap, Mail, User, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useApp } from '@/context/AppContext';

const Login = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { login } = useApp();
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleGoogleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email || !name) {
            toast({
                title: 'Missing information',
                description: 'Please enter both email and name',
                variant: 'destructive',
            });
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch('http://localhost:8080/api/v1/auth/google/dummy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, name }),
            });

            if (!response.ok) {
                throw new Error('Login failed');
            }

            const data = await response.json();

            // Store token and user info
            login({
                accessToken: data.access_token,
                userId: data.user_id,
                email: data.email,
            });

            toast({
                title: 'Welcome!',
                description: `Logged in as ${data.email}`,
            });

            // Navigate to home/landing page
            navigate('/');
        } catch (error) {
            toast({
                title: 'Login failed',
                description: error instanceof Error ? error.message : 'An error occurred',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background bg-noise relative overflow-hidden flex items-center justify-center">
            {/* Ambient glow effects */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-secondary/15 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 w-full max-w-md px-6">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="space-y-8"
                >
                    {/* Logo */}
                    <div className="text-center">
                        <div className="inline-flex items-center justify-center mb-4">
                            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center glow-primary">
                                <Zap className="w-10 h-10 text-primary-foreground" />
                            </div>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2 tracking-tight">
                            <span className="text-glow text-primary">SCENE</span>
                        </h1>
                        <p className="text-muted-foreground">
                            Be present, be ephemeral
                        </p>
                    </div>

                    {/* Login Form */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="bg-card/50 backdrop-blur-xl border border-border rounded-3xl p-8 shadow-2xl"
                    >
                        {/* Dev Notice */}
                        <div className="mb-6 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                            <p className="text-xs text-yellow-600 dark:text-yellow-400 text-center font-medium">
                                🛠️ Development Mode: Dummy Google Login
                            </p>
                        </div>

                        <form onSubmit={handleGoogleLogin} className="space-y-6">
                            {/* Email Input */}
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-sm font-medium">
                                    Email
                                </Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="your.email@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="pl-10 h-12 bg-background/50 border-border/50 focus:border-primary"
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            {/* Name Input */}
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-sm font-medium">
                                    Name
                                </Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                                    <Input
                                        id="name"
                                        type="text"
                                        placeholder="Your Name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="pl-10 h-12 bg-background/50 border-border/50 focus:border-primary"
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            {/* Submit Button */}
                            <Button
                                type="submit"
                                className="w-full h-12 text-base font-semibold rounded-xl gradient-primary text-primary-foreground glow-primary hover:scale-[1.02] transition-transform"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <span className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                                        Signing in...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        Sign in with Google
                                        <ArrowRight className="w-5 h-5" />
                                    </span>
                                )}
                            </Button>
                        </form>

                        {/* Footer */}
                        <div className="mt-6 pt-6 border-t border-border/50">
                            <p className="text-xs text-muted-foreground/60 text-center">
                                All scenes are temporary. All chats vanish.
                            </p>
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
};

export default Login;
