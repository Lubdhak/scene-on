import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useApp } from '@/context/AppContext';

const API_BASE_URL = "https://scene-on.onrender.com"

const Login = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { login } = useApp();
    const [isLoading, setIsLoading] = useState(false);

    const handleGoogleLogin = async () => {
        setIsLoading(true);

        try {
            // Get the Google OAuth URL from backend
            const response = await fetch(`${API_BASE_URL}/api/v1/auth/google/login`);
            
            if (!response.ok) {
                throw new Error('Failed to initiate Google login');
            }

            const data = await response.json();
            
            // Redirect to Google OAuth consent screen
            window.location.href = data.url;
        } catch (error) {
            toast({
                title: 'Login failed',
                description: error instanceof Error ? error.message : 'An error occurred',
                variant: 'destructive',
            });
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
                        <div className="space-y-6">
                            {/* Google Sign In Button */}
                            <Button
                                onClick={handleGoogleLogin}
                                className="w-full h-14 text-base font-semibold rounded-xl gradient-primary text-primary-foreground glow-primary hover:scale-[1.02] transition-transform"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <span className="flex items-center gap-3">
                                        <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                                        Redirecting to Google...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-3">
                                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                                            <path
                                                fill="currentColor"
                                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                            />
                                            <path
                                                fill="currentColor"
                                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                            />
                                            <path
                                                fill="currentColor"
                                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                            />
                                            <path
                                                fill="currentColor"
                                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                            />
                                        </svg>
                                        Continue with Google
                                    </span>
                                )}
                            </Button>
                        </div>

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
