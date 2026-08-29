import "@testing-library/react-native";
import "react-native-gesture-handler/jestSetup";

jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
