import unittest
from cratis_chronicle_contracts import eventtypes_pb2, eventtypes_pb2_grpc


class AuthorEventTypeTest(unittest.TestCase):
    def test_registration_identity(self):
        registration = eventtypes_pb2.EventType(Id="AuthorRegistered", Generation=1)
        decoded = eventtypes_pb2.EventType.FromString(registration.SerializeToString())
        self.assertEqual((decoded.Id, decoded.Generation), ("AuthorRegistered", 1))
        self.assertTrue(callable(eventtypes_pb2_grpc.EventTypesStub))
