import { assert } from 'chai'
import {
  connectionCreateConnect,
  dataProofCreate,
  proofCreate
} from 'helpers/entities'
import { gcTest } from 'helpers/gc'
import { TIMEOUT_GC } from 'helpers/test-constants'
import { initVcxTestMode, shouldThrow } from 'helpers/utils'
import { Connection, Proof, ProofState, rustAPI, StateType, VCXCode, VCXMock, VCXMockMessage } from 'src'

describe('Proof:', () => {
  before(() => initVcxTestMode())

  describe('create:', () => {
    it('success', async () => {
      await proofCreate()
    })

    it('throws: missing sourceId', async () => {
      const { sourceId, ...data } = await dataProofCreate()
      const error = await shouldThrow(() => Proof.create(data as any))
      assert.equal(error.vcxCode, VCXCode.INVALID_OPTION)
    })

    it('throws: missing attrs', async () => {
      const { attrs, ...data } = await dataProofCreate()
      const error = await shouldThrow(() => Proof.create(data as any))
      assert.equal(error.vcxCode, VCXCode.INVALID_OPTION)
    })

    it('throws: missing name', async () => {
      const { name, ...data } = await dataProofCreate()
      const error = await shouldThrow(() => Proof.create(data as any))
      assert.equal(error.vcxCode, VCXCode.INVALID_OPTION)
    })

    it('throws: invalid attr', async () => {
      const { attrs, ...data } = await dataProofCreate()
      const error = await shouldThrow(() => Proof.create({ attrs: 'invalid' as any, ...data }))
      assert.equal(error.vcxCode, VCXCode.INVALID_JSON)
    })
  })

  describe('serialize:', () => {
    it('success', async () => {
      const proof = await proofCreate()
      const data = await proof.serialize()
      assert.ok(data)
      assert.equal(data.source_id, proof.sourceId)
    })

    it('throws: not initialized', async () => {
      const proof = new (Proof as any)()
      const error = await shouldThrow(() => proof.serialize())
      assert.equal(error.vcxCode, VCXCode.INVALID_PROOF_HANDLE)
    })

    it('throws: proof released', async () => {
      const proof = await proofCreate()
      const data = await proof.serialize()
      assert.ok(data)
      assert.equal(data.source_id, proof.sourceId)
      assert.equal(await proof.release(), VCXCode.SUCCESS)
      const error = await shouldThrow(() => proof.serialize())
      assert.equal(error.vcxCode, VCXCode.INVALID_PROOF_HANDLE)
    })
  })

  describe('deserialize:', () => {
    it('success', async () => {
      const proof1 = await proofCreate()
      const data1 = await proof1.serialize()
      const proof2 = await Proof.deserialize(data1)
      assert.equal(proof2.sourceId, proof1.sourceId)
      const data2 = await proof2.serialize()
      assert.deepEqual(data1, data2)
    })

    it('throws: incorrect data', async () => {
      const error = await shouldThrow(async () => Proof.deserialize({ source_id: 'Invalid' } as any))
      assert.equal(error.vcxCode, VCXCode.INVALID_JSON)
    })
  })

  describe('release:', () => {
    it('success', async () => {
      const proof = await proofCreate()
      assert.equal(await proof.release(), VCXCode.SUCCESS)
      const errorSerialize = await shouldThrow(() => proof.serialize())
      assert.equal(errorSerialize.vcxCode, VCXCode.INVALID_PROOF_HANDLE)
    })

    it('throws: not initialized', async () => {
      const proof = new (Proof as any)()
      const error = await shouldThrow(() => proof.release())
      assert.equal(error.vcxCode, VCXCode.UNKNOWN_ERROR)
    })
  })

  describe('updateState:', () => {
    it(`returns ${StateType.None}: not initialized`, async () => {
      const proof = new (Proof as any)()
      await proof.updateState()
      assert.equal(await proof.getState(), StateType.None)
    })

    it(`returns ${StateType.Initialized}: created`, async () => {
      const proof = await proofCreate()
      await proof.updateState()
      assert.equal(await proof.getState(), StateType.Initialized)
    })
  })

  describe('requestProof:', () => {
    it('success', async () => {
      const connection = await connectionCreateConnect()
      const proof = await proofCreate()
      await proof.requestProof(connection)
      assert.equal(await proof.getState(), StateType.OfferSent)
    })

    it('success -> received', async () => {
      const connection = await connectionCreateConnect()
      const proof = await proofCreate()
      await proof.requestProof(connection)
      assert.equal(await proof.getState(), StateType.OfferSent)
      VCXMock.setVcxMock(VCXMockMessage.Proof)
      VCXMock.setVcxMock(VCXMockMessage.UpdateProof)
      await proof.updateState()
      assert.equal(await proof.getState(), StateType.RequestReceived)
      assert.equal(proof.proofState, ProofState.Verified)
      const proofData = await proof.getProof(connection)
      assert.ok(proofData)
      assert.ok(proofData.proof)
      assert.equal(proofData.proofState, proof.proofState)
    })

    it('throws: not initialized', async () => {
      const connection = await connectionCreateConnect()
      const proof = new (Proof as any)()
      const error = await shouldThrow(() => proof.requestProof(connection))
      assert.equal(error.vcxCode, VCXCode.INVALID_ISSUER_CREDENTIAL_HANDLE)
    })

    it('throws: connection not initialized', async () => {
      const connection = new (Connection as any)()
      const proof = await proofCreate()
      const error = await shouldThrow(() => proof.requestProof(connection))
      assert.equal(error.vcxCode, VCXCode.INVALID_CONNECTION_HANDLE)
    })
  })

  describe('GC:', function () {
    this.timeout(TIMEOUT_GC)

    const proofCreateAndDelete = async () => {
      let proof: Proof | null = await proofCreate()
      const handle = proof.handle
      proof = null
      return handle
    }
    it('calls release', async () => {
      const handle = await proofCreateAndDelete()
      await gcTest({
        handle,
        serialize: rustAPI().vcx_proof_serialize,
        stopCode: VCXCode.INVALID_PROOF_HANDLE
      })
    })
  })
})
