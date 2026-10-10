import { MigrationInterface, QueryRunner } from 'typeorm';

const IMPORTED_VALUES: [string, string | null, string | null][] = [
  ["0861833f-8b21-475d-95c5-42f3cd5e0130", "OTHER", null],
  ["0e0feaab-9004-4869-ad96-eb995201ca43", "INNOVATION_HUB", "BETWEEN_15_30_MINS"],
  ["140cb12e-553f-4429-82e0-44ae7b894d86", "OTHER", null],
  ["144f30c7-2e20-4b1a-b8d6-448fbc1f9aa3", "INNOVATION_HUB", "LESS_THAN_15_MINS"],
  ["1e069119-757d-4a74-b1a2-02d0237fab89", "INNOVATION_HUB", null],
  ["2974ea1e-726e-468a-bedd-ec83d95fa62d", "STARTUP_SUPPORT_ORGANIZATIONS", null],
  ["2c915a62-2450-40f9-a27c-844300fc610a", "INNOVATION_HUB", null],
  ["30941efe-b75d-4bb8-bb31-faa6b91e346f", "INNOVATION_HUB", "BETWEEN_15_30_MINS"],
  ["323d4c6d-5d86-42e8-b412-420dea3e39de", "INNOVATION_HUB", "BETWEEN_15_30_MINS"],
  ["344fb1a4-ae93-4b88-b468-cf6831f097bb", "INCUBATOR", "LESS_THAN_15_MINS"],
  ["40bb8bfa-f790-4650-9abb-4d0d220508ce", "STARTUP_SUPPORT_ORGANIZATIONS", null],
  ["4c6e6722-cb14-44d8-b1a2-bfe653ee27d2", "INNOVATION_HUB", null],
  ["4dbbdb5e-5e8a-4a75-9055-c2b9e5bef429", "STARTUP_SUPPORT_ORGANIZATIONS", "OVER_30_MINS"],
  ["525a4ba8-9412-4df1-8f2b-84562bf4ea44", "INNOVATION_HUB", "LESS_THAN_15_MINS"],
  ["58566331-1404-43dc-bdf6-51f73da694ec", "OTHER", null],
  ["5a01ff89-d047-4161-80ff-3ec6e6ebc6b4", "INNOVATION_HUB", "BETWEEN_15_30_MINS"],
  ["5d32d305-3804-43ff-9b7c-7c50c4cde20b", "OTHER", null],
  ["60d493c8-002a-4812-9049-fdcd85048fd9", "OTHER", null],
  ["68454b5a-900d-4a65-97c7-4c9e4f2ddfe6", "INNOVATION_HUB", "BETWEEN_15_30_MINS"],
  ["6e16991d-6b63-4a88-84c6-c3f120a438ef", "INNOVATION_HUB", null],
  ["6e817a58-de65-425a-a93c-c560df09522a", "INCUBATOR", "LESS_THAN_15_MINS"],
  ["6f513ed6-8d50-4c80-becb-3c2a230d8ec4", "INCUBATOR", "LESS_THAN_15_MINS"],
  ["718b0c06-5859-414b-b269-30a2dd9c4768", "INCUBATOR", "LESS_THAN_15_MINS"],
  ["7308e392-97e7-477c-9a9c-929eacde3db1", "INNOVATION_HUB", "BETWEEN_15_30_MINS"],
  ["7c2e60c6-f8e2-48f0-bdb8-d0ed88292769", "INCUBATOR", "BETWEEN_15_30_MINS"],
  ["7d7f925a-8610-4228-b435-c92a41a1f383", "OTHER", null],
  ["7fe57f93-fd24-4ccd-a5e9-cf13097503c1", "STARTUP_SUPPORT_ORGANIZATIONS", "BETWEEN_15_30_MINS"],
  ["8263cbde-349a-44e1-b837-6f008c1e1021", "STARTUP_SUPPORT_ORGANIZATIONS", "LESS_THAN_15_MINS"],
  ["84e3ebcc-8602-484d-b2ab-c1101806ba34", "INNOVATION_HUB", "LESS_THAN_15_MINS"],
  ["9497e203-3896-4dd2-865a-c502e902b8d3", "INCUBATOR", "BETWEEN_15_30_MINS"],
  ["c1a701b2-a087-42a6-89db-b1d4e75a2710", "STARTUP_SUPPORT_ORGANIZATIONS", null],
  ["c6ac6d12-a506-420b-b5c8-1524b6fc7720", "INNOVATION_HUB", "OVER_30_MINS"],
  ["cae4dd9f-2303-438f-b4a3-b41e01508410", "OTHER", null],
  ["cae6b4f6-e7e8-4199-87c4-e88dbc703f98", "STARTUP_SUPPORT_ORGANIZATIONS", "BETWEEN_15_30_MINS"],
  ["f1cf4a11-632e-4028-bbe4-c8f7cd2ce95c", "CREATIVE_HUBS", "LESS_THAN_15_MINS"],
  ["f1d59fbb-17f2-428b-a9da-5319181ee518", "INNOVATION_HUB", null],
  ["f4ebcb1a-6692-40a8-bf55-d4352203fc92", "INNOVATION_HUB", "BETWEEN_15_30_MINS"],
  ["faaa1ff4-ac01-4ef0-a430-9fccce37061b", "CREATIVE_HUBS", "BETWEEN_15_30_MINS"]
];

export class RepairImportedEnums1789860000000 implements MigrationInterface {
  name = 'RepairImportedEnums1789860000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [id, organisationType, proximity] of IMPORTED_VALUES) {
      if (organisationType) {
        await queryRunner.query(
          `UPDATE "applications" SET "organisationType" = $1 WHERE "id"::text = $2 AND "organisationType" IS NULL`,
          [organisationType, id],
        );
      }
      if (proximity) {
        await queryRunner.query(
          `UPDATE "applications" SET "proximityToHostInstitution" = $1 WHERE "id"::text = $2 AND "proximityToHostInstitution" IS NULL`,
          [proximity, id],
        );
      }
    }
  }

  public async down(): Promise<void> {
    return;
  }
}
