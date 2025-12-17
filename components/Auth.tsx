import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Button, Input, Label, Card, CardContent, CardHeader, CardTitle } from './ui';

export const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const { register, handleSubmit, setError, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      if (isLogin) {
        await auth.signInWithEmailAndPassword(data.email, data.password);
      } else {
        // Sign Up
        const cred = await auth.createUserWithEmailAndPassword(data.email, data.password);
        if (cred.user) {
            await cred.user.updateProfile({ displayName: data.name });
            
            // Create User Document
            const isAdmin = data.email === 'realovatsug@gmail.com';
            await setDoc(doc(db, "users", cred.user.uid), {
              id: cred.user.uid,
              name: data.name,
              email: data.email,
              isAdmin: isAdmin
            });
        }
      }
    } catch (e: any) {
      setError('root', { message: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">{isLogin ? "Sign In" : "Create Account"}</CardTitle>
          <p className="text-center text-sm text-muted-foreground">
            {isLogin ? "Enter your email and password to access the app" : "Enter your details to create an account"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" placeholder="John Doe" {...register('name', { required: !isLogin })} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="m@example.com" {...register('email', { required: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...register('password', { required: true, minLength: 6 })} />
              {errors.password && <span className="text-xs text-red-500">Min 6 chars</span>}
            </div>
            {errors.root && <div className="text-sm text-red-500">{errors.root.message}</div>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Loading..." : (isLogin ? "Sign In" : "Sign Up")}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => setIsLogin(!isLogin)} className="font-medium text-primary hover:underline">
              {isLogin ? "Sign Up" : "Sign In"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};