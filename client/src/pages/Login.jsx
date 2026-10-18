import { SignIn, SignUp } from '@clerk/react';

export default function Login({ mode = 'sign-in' }) {
  const isSignUp = mode === 'sign-up';
  return (
    <div className="grid min-h-screen bg-slate-950 lg:grid-cols-2">
      <section className="hidden bg-brand p-14 text-white lg:block">
        <p className="text-3xl font-bold">adpulse</p>
        <div className="mt-40">
          <h1 className="text-5xl font-bold leading-tight">Campaigns that make every impression count.</h1>
          <p className="mt-6 max-w-md text-lg text-indigo-100">Plan, launch, monitor and optimize your digital advertising from one focused workspace.</p>
        </div>
      </section>
      <section className="grid place-items-center p-5 sm:p-8">
        <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
          {isSignUp
            ? <SignUp path="/sign-up" routing="path" signInUrl="/login" signInFallbackRedirectUrl="/" forceRedirectUrl="/onboarding" />
            : <SignIn path="/login" routing="path" signUpUrl="/sign-up" signUpFallbackRedirectUrl="/onboarding" forceRedirectUrl="/" />}
        </div>
      </section>
    </div>
  );
}
