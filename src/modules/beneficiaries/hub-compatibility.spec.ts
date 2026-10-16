import { hubsShareCourses, sameState } from './hub-compatibility';

describe('hub compatibility', () => {
  it('treats standard and creative hubs as offering the same courses', () => {
    expect(hubsShareCourses('STANDARD', 'CREATIVE')).toBe(true);
    expect(hubsShareCourses('GAMING', 'GAMING')).toBe(true);
    expect(hubsShareCourses('GAMING', 'VR')).toBe(false);
    expect(hubsShareCourses('STANDARD', 'VR')).toBe(false);
    expect(hubsShareCourses(null, 'VR')).toBe(false);
  });

  it('compares institution states with the state enum', () => {
    expect(sameState('Kwara', 'KWARA')).toBe(true);
    expect(sameState('FCT', 'FCT')).toBe(true);
    expect(sameState('Akwa Ibom', 'AKWA_IBOM')).toBe(true);
    expect(sameState('Kogi', 'KWARA')).toBe(false);
  });
});
