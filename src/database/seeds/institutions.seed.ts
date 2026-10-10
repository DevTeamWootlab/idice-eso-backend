import { EntityManager } from 'typeorm';
import {
  HubType,
  Institution,
} from '@modules/institutions/entities/institution.entity';

const institutions = [
  [
    '0c9b8d16-a929-4449-8cd3-1391f7175796',
    'Benue State University',
    'Benue',
    HubType.STANDARD,
  ],
  [
    '81e4d3e6-a12d-4761-8d1d-89057ff42ea9',
    'University of Ilorin',
    'Kwara',
    HubType.GAMING,
  ],
  [
    '82eeadc4-81cf-40c9-af3f-d93ef1f85d2a',
    'Federal University of Technology, Minna',
    'Niger',
    HubType.VR,
  ],
  [
    '1c510fe8-ad6d-4204-84ec-7562eb5900c5',
    'Abdulkadir Kure University',
    'Niger',
    HubType.STANDARD,
  ],
  [
    '902c83e0-cb67-418c-9023-3d775e6c81b4',
    'Salem University',
    'Kogi',
    HubType.STANDARD,
  ],
  [
    '04e34081-9746-4d77-a729-c21c75147b8b',
    'National Open University of Nigeria (NOUN)',
    'FCT',
    HubType.STANDARD,
  ],
  [
    '3fb7b4e7-e625-44b9-b266-b74d5b38b2ae',
    'Federal Polytechnic Idah',
    'Kogi',
    HubType.STANDARD,
  ],
  [
    'e1012e27-3058-4443-85c2-2eec0ee79a76',
    'Federal Polytechnic Nasarawa',
    'Nasarawa',
    HubType.STANDARD,
  ],
  [
    '00605d6a-980d-406e-a669-c49fc93044cd',
    'National Film Institute Jos',
    'Plateau',
    HubType.CREATIVE,
  ],
  [
    '1fd0f539-e2b5-41ef-b9cd-0063d2bccfc7',
    'Kwara State Polytechnic',
    'Kwara',
    HubType.STANDARD,
  ],
  [
    '530c10b5-061b-4b89-946e-adc1f59d9e2f',
    'Prince Abubakar Audu University',
    'Kogi',
    HubType.STANDARD,
  ],
] as const;

export async function seedInstitutions(manager: EntityManager): Promise<void> {
  const repository = manager.getRepository(Institution);

  for (const [id, name, state, hubType] of institutions) {
    await repository.upsert(
      { id, name, state, hubType, isActive: true },
      ['name'],
    );

    const seeded = await repository.findOneBy({ name });
    if (seeded?.id !== id) {
      throw new Error(
        `Institution "${name}" has ID ${seeded?.id ?? '(missing)'}; expected ${id}. ` +
          'Resolve existing institution references before importing applications.',
      );
    }
  }
}
