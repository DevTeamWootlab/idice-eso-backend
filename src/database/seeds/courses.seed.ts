import { EntityManager } from 'typeorm';
import { TrainingTier } from '@common/enums/beneficiary.enum';
import { Course } from '@modules/training/entities/course.entity';

const courses = [
  ['Customer Service & Call Centre Operations', TrainingTier.FOUNDATIONAL, 8],
  ['Data Entry & Administrative Operations', TrainingTier.FOUNDATIONAL, 8],
  [
    'Technical Support & IT Helpdesk Fundamentals',
    TrainingTier.FOUNDATIONAL,
    8,
  ],
  ['Digital Literacy & Workplace Productivity', TrainingTier.FOUNDATIONAL, 8],
  ['Game Development Fundamentals', TrainingTier.FOUNDATIONAL, 8],
  ['Foundation of VR and Immersive 3D Creation', TrainingTier.FOUNDATIONAL, 8],
  [
    'Advanced Customer Service & Process Mapping',
    TrainingTier.INTERMEDIATE,
    12,
  ],
  ['Data Analysis & Business Intelligence', TrainingTier.INTERMEDIATE, 12],
  [
    'Content Creation, Digital Copywriting & SEO',
    TrainingTier.INTERMEDIATE,
    12,
  ],
  ['Digital Product Management', TrainingTier.INTERMEDIATE, 12],
  ['Graphic Design & Visual Identity', TrainingTier.INTERMEDIATE, 12],
  ['UI/UX Design', TrainingTier.INTERMEDIATE, 12],
  ['Coding & Software Engineering Basics', TrainingTier.INTERMEDIATE, 12],
  ['2D Animation & Motion Graphics', TrainingTier.INTERMEDIATE, 12],
  ['Programming, Level Design and Competitive Strategy', TrainingTier.INTERMEDIATE, 12],
  ['3D Assets, Animation and Engine Programming', TrainingTier.INTERMEDIATE, 12],
  ['Advanced Motion Graphics & 3D Animation', TrainingTier.ADVANCED, 20],
  ['Applied AI Tools for Creative & Technical Work', TrainingTier.ADVANCED, 20],
  ['Digital Marketing Strategy & Paid Media', TrainingTier.ADVANCED, 16],
  ['Cybersecurity & Data Protection', TrainingTier.ADVANCED, 16],
  ['Engine Optimisation, Tactical Mastery and Mental Resilience', TrainingTier.ADVANCED, 20],
  ['Advanced VR Engineering and XR Development Mastery', TrainingTier.ADVANCED, 20],
] as const;

const retiredCourses = [
  'Game Design & Interactive Media',
  'Virtual Reality (VR) / Augmented Reality (AR) Development',
];

export async function seedCourses(manager: EntityManager): Promise<void> {
  const repository = manager.getRepository(Course);

  for (const [title, tier, durationWeeks] of courses) {
    await repository.upsert(
      { title, tier, durationWeeks, isActive: true },
      ['title', 'tier'],
    );
  }
  for (const title of retiredCourses) {
    await repository.update({ title }, { isActive: false });
  }
}

