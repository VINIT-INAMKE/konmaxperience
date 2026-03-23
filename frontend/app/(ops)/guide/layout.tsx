import { GuideSearchOverlay } from '@/components/ops/guide/GuideSearchOverlay';

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <GuideSearchOverlay />
    </>
  );
}
