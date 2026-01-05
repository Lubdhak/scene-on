import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useApp } from '@/context/AppContext';

const AuthCallback = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { login } = useApp();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const handleCallback = () => {
            const token = searchParams.get('token');
            const userId = searchParams.get('user_id');
            const email = searchParams.get('email');

            if (!token || !userId || !email) {
                toast({
                    title: 'Authentication failed',
                    description: 'Missing authentication credentials',
                    variant: 'destructive',
                });
                navigate('/login');
                return;
            }

            // Store token and user info
            login({
                accessToken: token,
                userId: userId,
                email: email,
            });

            toast({
                title: 'Welcome!',
                description: `Logged in as ${email}`,
            });

            // Navigate to home/landing page
            navigate('/');
        };

        handleCallback();
    }, [searchParams, login, navigate, toast]);

    return (
        <div className="min-h-screen bg-background bg-noise relative overflow-hidden flex items-center justify-center">
            {/* Ambient glow effects */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-secondary/15 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 text-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-6"
                >
                    {/* Logo */}
                    <div className="inline-flex items-center justify-center mb-4">
                        <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center glow-primary">
                            <Zap className="w-12 h-12 text-primary-foreground" />
                        </div>
                    </div>
                    
                    {/* Loading Animation */}
                    <div className="flex items-center justify-center gap-2">
                        <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    
                    <h2 className="text-2xl font-semibold text-foreground">
                        Completing authentication...
                    </h2>
                    <p className="text-muted-foreground">
                        You'll be redirected in a moment
                    </p>
                </motion.div>
            </div>
        </div>
    );
};

export default AuthCallback;
