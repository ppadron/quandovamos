ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"

I18n.locale = :"pt-BR"

module ActiveSupport
  class TestCase
    parallelize(workers: :number_of_processors)
  end
end
