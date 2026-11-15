import { categoryFromHints } from '../category-hints';

const categories = [
  { id: 'tolls', name: 'Tolls', type: 'expense', isActive: true },
  { id: 'transit', name: 'Transit', type: 'expense', isActive: true },
  { id: 'food', name: 'Food & Dining', type: 'expense', isActive: true },
];

describe('categoryFromHints', () => {
  it.each([
    ['PLUS MALAYSIA BERHAD', 'Toll payment of RM5.40 at PLUS MALAYSIA BERHAD.', 'tolls'],
    [null, 'SmartTAG toll RM2.30 deducted.', 'tolls'],
    ['RAPID KL', 'Payment of RM3.50 to RAPID KL was successful.', 'transit'],
    ['MRT Corp', 'Payment of RM4.20 to MRT Corp was successful.', 'transit'],
    ['KTM BERHAD', "You've spent RM6.00 at KTM BERHAD.", 'transit'],
  ])('%s', (merchant, alert, expected) => {
    expect(categoryFromHints([merchant, alert], categories)).toBe(expected);
  });

  it.each([
    ['MR DIY PLUS', "You've spent RM12.00 at MR DIY PLUS."],
    ['Sushi Tei', 'Payment of RM40.00 to Sushi Tei was successful.'],
    ['Metro Mart', 'Payment of RM9.00 to Metro Mart.'],
    ['KFC', "You've spent RM25.00 at KFC."],
    ['PTPTN', "You've paid RM150.00 to PTPTN."],
    ['ETIQA TAKAFUL BERHAD', "MAYBANK: You've spent RM120.00 at ETIQA TAKAFUL BERHAD."],
  ])('leaves %s alone', (merchant, alert) => {
    expect(categoryFromHints([merchant, alert], categories)).toBeNull();
  });

  it('files under nothing when the category is deleted or missing', () => {
    expect(
      categoryFromHints(['RAPID KL'], [{ id: 'transit', name: 'Transit', type: 'expense', isActive: false }]),
    ).toBeNull();
    expect(categoryFromHints(['RAPID KL'], [])).toBeNull();
  });

  it('uses the category the user named themselves', () => {
    expect(
      categoryFromHints(['TOLL'], [{ id: 'mine', name: 'tolls', type: 'expense', isActive: true }]),
    ).toBe('mine');
  });
});
