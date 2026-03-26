'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BlurFade } from '@/components/ui/blur-fade';
import { CustomerOtpForm } from '@/components/public/CustomerOtpForm';
import type { Customer } from '@/lib/types/customer-auth';

export default function CustomerLoginPage() {
  const router = useRouter();

  const handleAuthenticated = (_c: Customer) => {
    router.push('/menu');
  };

  return (
    <BlurFade direction="up">
      <div className="max-w-sm mx-auto px-4 py-12">
        <CustomerOtpForm onAuthenticated={handleAuthenticated} />

        {/* Staff escape hatch */}
        <div className="pt-6 text-center">
          <Link
            href="/team"
            className="text-xs text-[var(--public-muted)] hover:text-[var(--public-fg)] transition-colors"
          >
            Staff? Go to team login →
          </Link>
        </div>
      </div>
    </BlurFade>
  );
}
