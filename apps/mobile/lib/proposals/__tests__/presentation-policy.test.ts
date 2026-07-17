import {
  proposalPresentationForSource,
  quietReviewCopy,
} from '@/lib/proposals/presentation-policy';

describe('proposal presentation policy', () => {
  it('takes explicit capture sources straight to the review artifact', () => {
    expect(proposalPresentationForSource('image')).toBe('immediate');
    expect(proposalPresentationForSource('text')).toBe('immediate');
  });

  it('keeps background notification captures quiet', () => {
    expect(proposalPresentationForSource('notification')).toBe('quiet');
    expect(proposalPresentationForSource(undefined)).toBe('quiet');
  });

  it('uses focused Continue/Later queue wording', () => {
    expect(quietReviewCopy(1)).toEqual({
      remaining: 0,
      queueLabel: 'One review waiting',
      primaryLabel: 'Continue',
      secondaryLabel: 'Later',
    });
    expect(quietReviewCopy(3).queueLabel).toBe('2 more to review');
  });
});
