'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { StarRatingInput } from '@/components/public/StarRatingInput';
import { FeedbackThankYou } from '@/components/public/FeedbackThankYou';
import { apiClient } from '@/lib/api-client';
import type { Feedback } from '@/lib/types/feedback';

export default function FeedbackPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId;

  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderNotFound, setOrderNotFound] = useState(false);

  useEffect(() => {
    async function checkOrder() {
      try {
        await apiClient.get(`/orders/${orderId}`);
      } catch {
        setOrderNotFound(true);
      }
    }
    void checkOrder();
  }, [orderId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post<Feedback>('/feedback', {
        order_id: orderId,
        rating,
        comment: comment || undefined,
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
      });
      setSubmitted(true);
    } catch {
      setError(
        "Feedback didn't go through — check your connection and try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return <FeedbackThankYou />;
  }

  return (
    <BlurFade direction="up">
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="space-y-2 mb-8">
          <h1 className="text-3xl font-semibold">Tell us about your meal</h1>
          <p className="text-sm text-muted-foreground">
            Quick feedback, big impact.
          </p>
        </div>

        {orderNotFound && (
          <div className="mb-6 rounded-lg bg-info/10 border border-info/20 px-4 py-3 text-sm text-info" role="status">
            We couldn&apos;t match this link to an order, but you can still share feedback.
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
          <div className="space-y-2">
            <label className="text-base font-normal">
              Rate your meal
            </label>
            <StarRatingInput value={rating} onChange={setRating} />
          </div>

          <div className="space-y-2">
            <label htmlFor="feedback-comment" className="text-sm text-foreground">
              Comments
            </label>
            <Textarea
              id="feedback-comment"
              placeholder="Tell us what you loved or what we can do better..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="bg-background border-input text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="feedback-name" className="text-sm text-foreground">
              Name <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="feedback-name"
              placeholder="Your name"
              maxLength={100}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="bg-background border-input text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="feedback-phone" className="text-sm text-foreground">
              Phone <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="feedback-phone"
              type="tel"
              placeholder="Your number"
              maxLength={20}
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="bg-background border-input text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <Button
            type="submit"
            disabled={rating < 1 || submitting}
            className="w-full h-11"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Sending feedback...
              </span>
            ) : (
              'Submit Feedback'
            )}
          </Button>

          {error && (
            <p role="alert" className="text-sm text-destructive text-center">
              {error}
            </p>
          )}
        </form>
      </div>
    </BlurFade>
  );
}
