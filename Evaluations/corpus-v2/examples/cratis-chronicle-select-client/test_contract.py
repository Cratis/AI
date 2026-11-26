import unittest
from cratis_chronicle_contracts import eventtypes_pb2, eventtypes_pb2_grpc


class ContractTest(unittest.TestCase):
    def test_wire_roundtrip_and_service_stub(self):
        fact = eventtypes_pb2.EventType(Id="AuthorRegistered", Generation=1)
        copy = eventtypes_pb2.EventType.FromString(fact.SerializeToString())
        self.assertEqual((copy.Id, copy.Generation), ("AuthorRegistered", 1))
        self.assertTrue(callable(eventtypes_pb2_grpc.EventTypesStub))
