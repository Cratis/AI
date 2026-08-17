# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

defmodule FactoryFixture.MixProject do
  use Mix.Project

  def project do
    [app: :factory_fixture, version: "0.1.0", deps: [{:cratis_chronicle, "2.1.3"}]]
  end
end
