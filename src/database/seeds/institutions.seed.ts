import { EntityManager } from 'typeorm';
import {
  HubType,
  Institution,
} from '@modules/institutions/entities/institution.entity';

const institutions = [
  ['Benue State University', 'Benue', HubType.STANDARD],
  ['University of Ilorin', 'Kwara', HubType.GAMING],
  ['Federal University of Technology, Minna', 'Niger', HubType.VR],
  ['Abdulkadir Kure University', 'Niger', HubType.STANDARD],
  ['Salem University', 'Kogi', HubType.STANDARD],
  ['National Open University of Nigeria (NOUN)', 'FCT', HubType.STANDARD],
  ['Federal Polytechnic Idah', 'Kogi', HubType.STANDARD],
  ['Federal Polytechnic Nasarawa', 'Nasarawa', HubType.STANDARD],
  ['National Film Institute Jos', 'Plateau', HubType.CREATIVE],
  ['Kwara State Polytechnic', 'Kwara', HubType.STANDARD],
  ['Prince Abubakar Audu University', 'Kogi', HubType.STANDARD],
] as const;

export async function seedInstitutions(manager: EntityManager): Promise<void> {
  const repository = manager.getRepository(Institution);

  for (const [name, state, hubType] of institutions) {
    await repository.upsert(
      { name, state, hubType, isActive: true },
      ['name'],
    );
  }
}
